"""
main.py — FastAPI app exposing our payment flow as HTTP endpoints.

WHY FASTAPI:
- Automatic request validation (via Pydantic models below) — if the frontend
  sends bad data, we get a clear 422 error instead of a mysterious crash.
- Automatic interactive docs at /docs — useful for testing without a frontend
  yet, and for your demo video ("here's the live API docs").
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from qr_handler import generate_shop_qr, decode_qr_payload
from payment_flow import process_payment_request
from razorpay_payment import create_payment_order, verify_payment_signature

app = FastAPI(
    title="Transparent Cross-Border QR Pay",
    description="Scan a shop's QR, see the true conversion rate, and get warned about hidden markups before paying.",
    version="0.1.0",
)

# CORS: allows a web frontend (running on a different port/origin) to call
# this API from the browser. Wide open ("*") is fine for a prototype demo;
# in production you'd lock this down to your actual frontend's domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Request/response schemas ----
# Pydantic models double as documentation AND validation — FastAPI uses
# these to auto-generate the /docs page and reject malformed requests.

class GenerateQRRequest(BaseModel):
    shop_name: str = Field(..., example="Bangkok Coffee Corner")
    shop_currency: str = Field(..., example="THB")
    upi_id: str = Field(..., example="coffeecorner@bangkokbank")


class ScanAndAssessRequest(BaseModel):
    qr_data: str = Field(..., description="The raw JSON string scanned from the shop's QR code")
    amount_in_shop_currency: float = Field(..., gt=0, example=500)
    payer_home_currency: str = Field(..., example="INR")
    offered_rate: Optional[float] = Field(
        None,
        description="If the shop's terminal is offering a specific conversion rate, pass it here. Omit if unknown."
    )


class CreateOrderRequest(BaseModel):
    amount_in_rupees: float = Field(..., gt=0, example=75.0)
    shop_name: str = Field(..., example="Seoul Snack Bar")


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ---- Endpoints ----

@app.get("/")
def health_check():
    """Basic liveness check — useful to confirm the server is up."""
    return {"status": "ok", "service": "Transparent Cross-Border QR Pay API"}


@app.post("/shop/generate-qr")
def api_generate_qr(request: GenerateQRRequest):
    """
    Simulates a SHOP generating its payment QR code.
    In a real deployment, this would be called once by the shop owner's
    app/dashboard, not by the payer.
    """
    try:
        result = generate_shop_qr(
            shop_name=request.shop_name,
            shop_currency=request.shop_currency,
            upi_id=request.upi_id,
            output_path=f"/home/claude/qr-pay-project/data/{request.shop_name.replace(' ', '_')}_qr.png",
        )
        return {
            "payload": result["payload"],
            "qr_data_string": __import__("json").dumps(result["payload"]),
            "note": "In the real app, the payer scans the QR IMAGE with their camera. This endpoint also returns the raw string for easy testing without a camera.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/payer/scan-and-assess")
def api_scan_and_assess(request: ScanAndAssessRequest):
    """
    The core endpoint: PAYER scans a QR, we fetch the live rate, compare it
    against what's being offered, and return a risk-flagged breakdown.
    """
    try:
        result = process_payment_request(
            qr_data=request.qr_data,
            amount_in_shop_currency=request.amount_in_shop_currency,
            payer_home_currency=request.payer_home_currency,
            offered_rate=request.offered_rate,
        )
        return result
    except ValueError as e:
        # ValueError = expected, user-facing problems (bad QR, unsupported currency)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Anything else = unexpected — still don't leak a stack trace to the client
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.post("/payment/create-order")
def api_create_order(request: CreateOrderRequest):
    """
    STEP AFTER the risk check: once the payer has seen the fair price and
    the risk verdict, and decides to proceed anyway, this creates a real
    Razorpay TEST MODE order — simulating what a live checkout would do.
    """
    try:
        result = create_payment_order(
            amount_in_rupees=request.amount_in_rupees,
            receipt_id=f"receipt_{request.shop_name.replace(' ', '_')}",
            notes={"shop_name": request.shop_name},
        )
        return result
    except RuntimeError as e:
        # Missing API keys — a setup problem, not a user error
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/payment/verify")
def api_verify_payment(request: VerifyPaymentRequest):
    """
    Called after the payer completes Razorpay's checkout popup. NEVER trust
    a frontend's claim that payment succeeded — always verify the signature
    server-side first.
    """
    try:
        is_valid = verify_payment_signature(
            order_id=request.razorpay_order_id,
            payment_id=request.razorpay_payment_id,
            signature=request.razorpay_signature,
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail="Payment signature verification failed — this payment cannot be trusted.")
        return {"status": "verified", "message": "Payment confirmed successfully (test mode)."}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
