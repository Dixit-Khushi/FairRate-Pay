/**
 * FairRate Pay — Travel Document & Customs FX Risk Clearance
 * Built with React 18 (Functional Components + Hooks) & Tailwind CSS
 * Features Real QR File Upload Decoding (jsQR) & Live Camera Scanner (getUserMedia)
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const API_BASE_URL = 'http://localhost:8000';

const PRESETS = [
  {
    id: 'bangkok',
    flag: '🇹🇭',
    country: 'Thailand',
    shop_name: 'Bangkok Coffee Corner',
    currency: 'THB',
    upi_id: 'coffeecorner@bangkokbank',
    amount: 500,
    suggested_dcc_rate: 3.30
  },
  {
    id: 'seoul',
    flag: '🇰🇷',
    country: 'South Korea',
    shop_name: 'Seoul Snack Bar',
    currency: 'KRW',
    upi_id: 'snackseoul@shinhanbank',
    amount: 12000,
    suggested_dcc_rate: 0.08
  },
  {
    id: 'tokyo',
    flag: '🇯🇵',
    country: 'Japan',
    shop_name: 'Tokyo Ramen Yatai',
    currency: 'JPY',
    upi_id: 'ramenyatai@mizuho',
    amount: 1500,
    suggested_dcc_rate: 0.70
  }
];

function App() {
  const [apiConnected, setApiConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'upload' | 'camera' | 'manual'
  
  // Merchant & Form State
  const [qrPayloadString, setQrPayloadString] = useState('');
  const [shopName, setShopName] = useState('Bangkok Coffee Corner');
  const [shopCurrency, setShopCurrency] = useState('THB');
  const [shopId, setShopId] = useState('d73981bc');
  const [upiId, setUpiId] = useState('coffeecorner@bangkokbank');
  
  const [amount, setAmount] = useState(500);
  const [homeCurrency, setHomeCurrency] = useState('INR');
  const [offeredRate, setOfferedRate] = useState('3.30');
  
  // Results & Scan Notifications State
  const [isLoading, setIsLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);

  // Camera Scanning State & Refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const animFrameRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Checkout Modal State
  const [showModal, setShowModal] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // 1. Initial Health Check & Default Load
  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then(res => res.ok ? setApiConnected(true) : setApiConnected(false))
      .catch(() => setApiConnected(false));

    // Load default Bangkok preset
    loadPreset(PRESETS[0]);
  }, []);

  // Stop camera when switching tabs or unmounting
  useEffect(() => {
    if (activeTab !== 'camera') {
      stopCameraScan();
    } else {
      startCameraScan();
    }
    return () => stopCameraScan();
  }, [activeTab]);

  const loadPreset = (preset) => {
    const payload = {
      shop_id: preset.id + '_001',
      shop_name: preset.shop_name,
      currency: preset.currency,
      upi_id: preset.upi_id
    };
    const jsonStr = JSON.stringify(payload);
    setQrPayloadString(jsonStr);
    setShopName(preset.shop_name);
    setShopCurrency(preset.currency);
    setShopId(payload.shop_id);
    setUpiId(preset.upi_id);
    setAmount(preset.amount);
    setOfferedRate(preset.suggested_dcc_rate.toString());
    setScanMessage({ type: 'success', text: `Loaded travel voucher: ${preset.shop_name} (${preset.currency})` });
  };

  // 2. Validate & Process Scanned QR Payload String
  const processDecodedQrText = useCallback((decodedText, sourceName = 'Image') => {
    setScanMessage(null);
    if (!decodedText || typeof decodedText !== 'string') {
      setScanMessage({ type: 'error', text: `❌ Failed to extract text data from ${sourceName}.` });
      return false;
    }

    try {
      const parsed = JSON.parse(decodedText);
      const requiredFields = ['shop_id', 'shop_name', 'currency', 'upi_id'];
      const missing = requiredFields.filter(field => !parsed[field]);

      if (missing.length > 0) {
        setScanMessage({
          type: 'error',
          text: `⚠️ QR Code scanned, but data is missing required merchant payment fields (${missing.join(', ')}). Expected JSON with shop_name, currency, upi_id.`
        });
        return false;
      }

      // Valid merchant JSON payload!
      setQrPayloadString(decodedText);
      setShopName(parsed.shop_name);
      setShopCurrency(parsed.currency.toUpperCase());
      setShopId(parsed.shop_id);
      setUpiId(parsed.upi_id);
      if (parsed.amount) {
        setAmount(parsed.amount);
      }

      setScanMessage({
        type: 'success',
        text: `✓ Decoded valid merchant QR (${sourceName}): ${parsed.shop_name} [${parsed.currency.toUpperCase()}]`
      });
      return true;

    } catch (err) {
      setScanMessage({
        type: 'error',
        text: `❌ QR Code scanned, but payload is not a valid JSON string (Error: ${err.message}). Payload received: "${decodedText.substring(0, 40)}..."`
      });
      return false;
    }
  }, []);

  // 3. Real QR Image File Upload Decoder (Canvas + jsQR)
  const handleQrFileUpload = (file) => {
    if (!file) return;
    setScanMessage({ type: 'info', text: `Scanning image file "${file.name}"...` });

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof jsQR === 'function') {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            processDecodedQrText(code.data, `File: ${file.name}`);
          } else {
            setScanMessage({
              type: 'error',
              text: `❌ Could not detect a valid QR code in "${file.name}". Please ensure the image is clear and well-lit, or select a Travel Preset.`
            });
          }
        } else {
          setScanMessage({ type: 'error', text: '❌ jsQR scanner engine not available in browser context.' });
        }
      };
      img.onerror = () => {
        setScanMessage({ type: 'error', text: `❌ Unable to read image file "${file.name}".` });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 4. Live Device Camera Scanner (getUserMedia + jsQR frame loop)
  const startCameraScan = async () => {
    setCameraError(null);
    setScanMessage({ type: 'info', text: 'Initializing device camera stream...' });

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser mediaDevices API not supported in this environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });

      mediaStreamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanFrame = () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (typeof jsQR === 'function') {
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code && code.data) {
                const success = processDecodedQrText(code.data, 'Live Camera');
                if (success) {
                  stopCameraScan();
                  return; // Stop scanning loop on success
                }
              }
            }
          }
          animFrameRef.current = requestAnimationFrame(scanFrame);
        };

        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.warn('Camera error:', err);
      setIsCameraActive(false);
      setCameraError(err.message || 'Camera access denied or unavailable.');
      setScanMessage({
        type: 'error',
        text: `⚠️ Camera access error: ${err.name === 'NotAllowedError' ? 'Permission denied by user.' : err.message}. Please use File Upload or Travel Presets.`
      });
    }
  };

  const stopCameraScan = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // 5. API Call: Assess Risk
  const handleAssessSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAssessment(null);

    const payload = {
      qr_data: qrPayloadString,
      amount_in_shop_currency: parseFloat(amount),
      payer_home_currency: homeCurrency,
      offered_rate: offeredRate !== '' ? parseFloat(offeredRate) : null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/payer/scan-and-assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Assessment failed');
      }

      const data = await res.json();
      setAssessment(data);
    } catch (err) {
      alert(`API Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 6. API Call: Create Order
  const handleProceedPayment = async () => {
    if (!assessment) return;
    setShowModal(true);
    setIsCreatingOrder(true);
    setOrderResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_in_rupees: assessment.you_pay,
          shop_name: assessment.shop_name
        })
      });

      if (res.ok) {
        const data = await res.json();
        setOrderResult({
          status: 'success',
          order_id: data.order_id,
          amount: data.amount_in_rupees,
          key_id: data.key_id,
          note: 'Razorpay Sandbox Test Order Created'
        });
      } else {
        const err = await res.json();
        setOrderResult({
          status: 'simulated',
          order_id: `sim_ord_${Math.random().toString(36).substring(2, 9)}`,
          amount: assessment.you_pay,
          key_id: 'rzp_test_sandbox_mode',
          note: err.detail || 'Payment flow executed in Sandbox Simulation Mode.'
        });
      }
    } catch (err) {
      setOrderResult({
        status: 'simulated',
        order_id: `sim_ord_${Math.random().toString(36).substring(2, 9)}`,
        amount: assessment.you_pay,
        key_id: 'rzp_test_offline',
        note: 'Completed test payment order simulation.'
      });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const currencySymbol = useMemo(() => {
    const map = { INR: '₹', USD: '$', EUR: '€', GBP: '£', SGD: 'S$', AUD: 'A$', AED: 'AED ' };
    return map[homeCurrency] || `${homeCurrency} `;
  }, [homeCurrency]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header Banner: Travel Passport & Customs ID */}
      <header className="bg-[#f7f6f0] border border-slate-300 rounded-lg p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white p-3 rounded font-mono font-bold text-xl tracking-wider">
            FR-PAY
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">FairRate Pay</h1>
              <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded uppercase font-semibold">Customs FX Declaration</span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Cross-Border QR Payment Markup Guard • Razorpay AI Risk Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="text-xs font-mono bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Sandbox Test Mode
          </span>
          <span className={`text-xs font-mono px-3 py-1 rounded font-semibold border flex items-center gap-1.5 ${apiConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'}`}>
            <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            {apiConnected ? 'API Connected' : 'API Offline'}
          </span>
        </div>
      </header>

      {/* Main Grid: Left Input Ticket / Right Customs Clearance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: QR Scan & Entry (5 cols) */}
        <section className="lg:col-span-5 bg-[#f7f6f0] border border-slate-300 rounded-lg p-6 space-y-5 shadow-sm">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-700 flex items-center gap-2">
              <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-xs">1</span>
              Merchant QR & Voucher
            </h2>
            <span className="barcode-strip hidden sm:inline">||| | |||| | |||</span>
          </div>

          {/* QR Method Tabs */}
          <div className="flex bg-slate-200/80 p-1 rounded-md text-xs font-mono">
            <button 
              onClick={() => setActiveTab('presets')} 
              className={`flex-1 py-1.5 px-2 rounded font-semibold transition ${activeTab === 'presets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              ⚡ Presets
            </button>
            <button 
              onClick={() => setActiveTab('upload')} 
              className={`flex-1 py-1.5 px-2 rounded font-semibold transition ${activeTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              📁 Upload Image
            </button>
            <button 
              onClick={() => setActiveTab('camera')} 
              className={`flex-1 py-1.5 px-2 rounded font-semibold transition ${activeTab === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              🎥 Live Camera
            </button>
            <button 
              onClick={() => setActiveTab('manual')} 
              className={`flex-1 py-1.5 px-2 rounded font-semibold transition ${activeTab === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              📝 Raw JSON
            </button>
          </div>

          {/* Tab 1: Presets */}
          {activeTab === 'presets' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-mono">Select foreign merchant QR voucher:</p>
              <div className="space-y-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className={`w-full text-left p-3 rounded border transition flex items-center justify-between ${shopName === preset.shop_name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{preset.flag}</span>
                      <div>
                        <div className="text-sm font-bold">{preset.shop_name}</div>
                        <div className={`text-xs font-mono ${shopName === preset.shop_name ? 'text-slate-300' : 'text-slate-500'}`}>
                          {preset.currency} • {preset.country}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${shopName === preset.shop_name ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-700'}`}>
                      {preset.amount} {preset.currency}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Real File Upload Decoder */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div className="passport-dropzone rounded-md p-6 text-center cursor-pointer relative bg-white/60">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => e.target.files?.[0] && handleQrFileUpload(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-2">
                  <svg className="w-8 h-8 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <div className="text-xs font-bold text-slate-800">Drop QR photo or click to browse</div>
                  <div className="text-[11px] font-mono text-slate-500">Reads & decodes QR matrix via jsQR</div>
                </div>
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                💡 Tip: Upload QR files from <code>data/Bangkok_Coffee_Corner_qr.png</code> or <code>data/Seoul_Snack_Bar_qr.png</code> to test real file decoding!
              </p>
            </div>
          )}

          {/* Tab 3: Live Device Camera Scanner */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="camera-container aspect-video relative flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <div className="scan-viewfinder">
                  <div className="scan-beam"></div>
                </div>
                {!isCameraActive && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center text-white space-y-2">
                    <div className="text-2xl">📷</div>
                    <div className="text-xs font-mono font-bold">{cameraError || 'Camera Stream Offline'}</div>
                    <button 
                      onClick={startCameraScan}
                      className="bg-slate-800 hover:bg-slate-700 text-xs font-mono px-3 py-1.5 rounded border border-slate-600 text-slate-200"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-500 text-center">
                Point camera at shop QR code. Auto-detects & decodes frames in real time.
              </div>
            </div>
          )}

          {/* Tab 4: Manual JSON */}
          {activeTab === 'manual' && (
            <div className="space-y-2">
              <label className="text-xs font-mono font-semibold text-slate-600">Raw JSON Payload:</label>
              <textarea 
                rows="3" 
                value={qrPayloadString}
                onChange={(e) => processDecodedQrText(e.target.value, 'Manual Input')}
                className="w-full text-xs font-mono p-2.5 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          )}

          {/* Scan Messages & Validation Feedback */}
          {scanMessage && (
            <div className={`text-xs font-mono p-3 rounded border leading-relaxed ${scanMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : scanMessage.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-rose-50 text-rose-800 border-rose-300'}`}>
              {scanMessage.text}
            </div>
          )}

          {/* Scanned Merchant Ticket Stub */}
          <div className="bg-white border border-slate-300 rounded p-4 space-y-2 font-mono text-xs">
            <div className="flex justify-between items-center text-slate-500 border-b border-slate-200 pb-2">
              <span>SHOP: <strong className="text-slate-900">{shopName}</strong></span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{shopCurrency}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
              <div>ID: <span className="text-slate-900 font-bold">{shopId}</span></div>
              <div>UPI: <span className="text-slate-900 truncate block">{upiId}</span></div>
            </div>
          </div>

          {/* Transaction Input Form */}
          <form onSubmit={handleAssessSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Amount ({shopCurrency}):</label>
                <input 
                  type="number" 
                  step="any"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-sm font-mono font-bold p-2.5 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Home Currency:</label>
                <select 
                  value={homeCurrency}
                  onChange={(e) => setHomeCurrency(e.target.value)}
                  className="w-full text-sm font-mono font-bold p-2.5 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD (S$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="AED">AED</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Terminal Offered Rate (Optional):</label>
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">DCC Simulator</span>
              </div>
              <input 
                type="number"
                step="0.0001"
                placeholder="e.g. 3.30 (Leave empty for live interbank rate)"
                value={offeredRate}
                onChange={(e) => setOfferedRate(e.target.value)}
                className="w-full text-sm font-mono p-2.5 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                Leave blank to check live rate, or enter a higher rate to simulate terminal DCC markup.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-sm py-3 px-4 rounded transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Checking Interbank FX Rate...
                </>
              ) : (
                <>
                  🔍 CLEAR CURRENCY TRANSACTION
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right Column: Customs FX Clearance Verdict Card (7 cols) */}
        <section className="lg:col-span-7 bg-[#f7f6f0] border border-slate-300 rounded-lg p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-700 flex items-center gap-2">
              <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-xs">2</span>
              Customs FX Clearance & Risk Score
            </h2>
            <span className="text-xs font-mono text-slate-400">PASSPORT STAMP VERDICT</span>
          </div>

          {/* Placeholder state */}
          {!assessment && !isLoading && (
            <div className="my-auto text-center py-16 px-4 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-2xl text-slate-500">
                🛂
              </div>
              <h3 className="text-base font-bold text-slate-800">Awaiting Transaction Assessment</h3>
              <p className="text-xs text-slate-500 font-mono max-w-sm mx-auto">
                Scan a real QR code image or select a merchant voucher on the left, then click <strong>"Clear Currency Transaction"</strong> to run real-time FX & ML markup verification.
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="my-auto text-center py-16 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="text-xs font-mono font-bold text-slate-700">Verifying live interbank rates & scoring ML risk model...</div>
            </div>
          )}

          {/* Assessment Results Screen */}
          {assessment && !isLoading && (
            <div className="space-y-6">

              {/* UNMISSABLE CUSTOMS STAMP VERDICT */}
              <div className={`customs-stamp ${assessment.verdict === 'fair' ? 'stamp-fair' : assessment.verdict === 'elevated' ? 'stamp-elevated' : 'stamp-high'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-mono font-bold tracking-widest opacity-80">PASSPORT CLEARANCE VERDICT</div>
                    <div className="text-xl font-extrabold font-mono mt-1">
                      {assessment.verdict === 'fair' && '✓ APPROVED RATE • STAMPED FAIR'}
                      {assessment.verdict === 'elevated' && '⚠️ ELEVATED MARKUP • PROCEED WITH CAUTION'}
                      {assessment.verdict === 'high' && '🚨 REJECT: HIGH-RISK DCC ABUSE DETECTED'}
                    </div>
                  </div>
                  <span className="text-2xl font-bold font-mono">
                    {assessment.verdict === 'fair' ? 'CLEAR' : assessment.verdict === 'elevated' ? 'WARN' : 'REJECT'}
                  </span>
                </div>
                <p className="text-xs font-sans mt-3 leading-relaxed border-t border-current/20 pt-2 font-medium">
                  {assessment.message}
                </p>
              </div>

              {/* Tabular FX Rate Breakdown Table */}
              <div className="bg-white border border-slate-300 rounded p-4 space-y-3">
                <div className="text-xs font-mono font-bold text-slate-500 uppercase border-b border-slate-200 pb-1.5 flex justify-between">
                  <span>Exchange Rate Breakdown</span>
                  <span>Source: {assessment.rate_source.toUpperCase()}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">True Market Rate:</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      1 {assessment.shop_currency} = {assessment.true_market_rate.toFixed(4)} {assessment.payer_currency}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Terminal Offered Rate:</span>
                    <strong className="text-sm text-slate-900 tabular-nums">
                      1 {assessment.shop_currency} = {assessment.offered_rate.toFixed(4)} {assessment.payer_currency}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-500 block">You Pay Total:</span>
                    <strong className="text-base text-slate-900 tabular-nums font-bold">
                      {currencySymbol}{assessment.you_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Fair Price Would Be:</span>
                    <strong className="text-base text-emerald-700 tabular-nums font-bold">
                      {currencySymbol}{assessment.fair_price_would_be.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Estimated Overcharge Alert Banner */}
              {assessment.potential_overpay > 0 && (
                <div className="bg-rose-100 border border-rose-300 rounded p-3 text-center">
                  <div className="text-xs font-mono font-bold text-rose-800 uppercase">Estimated Overcharge / DCC Loss:</div>
                  <div className="text-2xl font-mono font-extrabold text-rose-700 tabular-nums mt-0.5">
                    +{currencySymbol}{assessment.potential_overpay.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-rose-800">
                    ({(((assessment.offered_rate - assessment.true_market_rate) / assessment.true_market_rate) * 100).toFixed(2)}% markup above interbank rate)
                  </div>
                </div>
              )}

              {/* ML Fraud Risk Model Gauge */}
              <div className="bg-white border border-slate-300 rounded p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono font-bold">
                  <span className="text-slate-800">🤖 ML Fraud & DCC Risk Model</span>
                  <span className={`px-2 py-0.5 rounded ${assessment.ml_risk_score?.risk_probability > 0.6 ? 'bg-rose-100 text-rose-800' : assessment.ml_risk_score?.risk_probability > 0.25 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {assessment.ml_risk_score?.risk_percent_label || 'N/A'} Risk Score
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full progress-fill ${assessment.ml_risk_score?.risk_probability > 0.6 ? 'bg-rose-600' : assessment.ml_risk_score?.risk_probability > 0.25 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                    style={{ width: `${Math.min(100, Math.max(5, (assessment.ml_risk_score?.risk_probability || 0) * 100))}%` }}
                  ></div>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                  Logistic Regression probability trained on synthetic cross-border transactions evaluating pair risk, markup %, and amount at stake.
                </p>
              </div>

              {/* Action Button: Proceed to Pay */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProceedPayment}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-sm py-3.5 px-4 rounded transition shadow flex items-center justify-center gap-2"
                >
                  💳 PROCEED TO PAY ({currencySymbol}{assessment.you_pay.toFixed(2)})
                </button>
                <p className="text-[11px] font-mono text-slate-500 text-center mt-2">
                  🔒 Executed via Razorpay Test / Sandbox Mode. Honest demo simulation.
                </p>
              </div>

            </div>
          )}

        </section>

      </div>

      {/* Payment Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="bg-[#f7f6f0] border border-slate-400 rounded-lg max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-300 pb-3">
              <h3 className="text-sm font-bold font-mono text-slate-900">🧪 RAZORPAY TEST MODE CHECKOUT</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-800 font-bold">&times;</button>
            </div>

            {isCreatingOrder ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="text-xs font-mono">Creating Razorpay Test Order...</div>
              </div>
            ) : orderResult && (
              <div className="space-y-4 font-mono text-xs">
                <div className="text-center py-2">
                  <div className="text-3xl mb-1">✅</div>
                  <div className="text-base font-bold text-slate-900">Payment Order Created</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">{orderResult.note}</div>
                </div>

                <div className="bg-white border border-slate-300 rounded p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order ID:</span>
                    <strong className="text-slate-900">{orderResult.order_id}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Merchant:</span>
                    <strong className="text-slate-900">{shopName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount (INR):</span>
                    <strong className="text-slate-900">₹{orderResult.amount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Razorpay Key:</span>
                    <span className="text-slate-700">{orderResult.key_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{orderResult.status}</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded text-[11px]">
                  <strong>Demo Note:</strong> In live production, this step invokes Razorpay's Checkout Modal. In sandbox mode, it completes order verification server-side.
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-slate-900 text-white font-bold py-2.5 rounded hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center font-mono text-xs text-slate-500 py-4 border-t border-slate-300">
        FairRate Pay • Built for Razorpay AI Buildathon 2026 (AI Risk Manager Track)
      </footer>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
