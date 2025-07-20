let selectedKarat = 18;
let currentWeight = 0;
let currentGoldPrice = 3400;
let weightSocket = null;
let priceSocket = null;
let sessionTokens = null;
let sessionRefreshInterval = null;
let previousPrice = 0;
// const SESSION_REFRESH_TIME = 30 * 60 * 1000; 

const priceFluctuationRange = 1; // ±50 ريال
let isFluctuationEnabled = true; 

const karatMultipliers = {
  24: 1.0,    
  21: 0.875,  
  18: 0.75    
};


const currentWeightElement = document.getElementById('current-weight');
const connectionStatusElement = document.getElementById('connection-status');
const priceConnectionStatusElement = document.getElementById('price-connection-status');
const priceValueElement = document.getElementById('price-value');
const priceArrowElement = document.getElementById('price-arrow');
const priceCurrencyElement = document.getElementById('price-currency');

let goldMode = 'sell'; 

const DEFAULT_BUY_DISCOUNT = 20;
const DEFAULT_FLUCTUATION_RANGE = 1;


document.addEventListener('DOMContentLoaded', function() {
  selectKarat(18); 
  connectToWeightSocket();
  initializePriceConnection();
  updateModeUI();
});


function connectToWeightSocket() {
  updateConnectionStatus(connectionStatusElement, false, 'حالة الميزان: جاري الاتصال...');
  
  try {
    weightSocket = new WebSocket('ws://' + window.location.hostname + ':81/');

    weightSocket.onopen = function() {
      updateConnectionStatus(connectionStatusElement, true, 'حالة الميزان: متصل');
    };

    weightSocket.onmessage = function(e) {
      const weight = parseFloat(e.data);
      if (!isNaN(weight)) {
        currentWeight = weight;
        currentWeightElement.textContent = currentWeight.toFixed(2);
        updateMainPriceDisplay();
      }
    };

    weightSocket.onclose = function() {
      updateConnectionStatus(connectionStatusElement, false, 'حالة الميزان: انقطع الاتصال');
      setTimeout(connectToWeightSocket, 3000);
    };

    weightSocket.onerror = function(error) {
      console.error('Weight socket error:', error);
      updateConnectionStatus(connectionStatusElement, false, 'حالة الميزان: خطأ في الاتصال');
    };
  } catch (error) {
    console.error('Error creating weight socket:', error);
    updateConnectionStatus(connectionStatusElement, false, 'حالة الميزان: خطأ في الاتصال');
    setTimeout(connectToWeightSocket, 5000);
  }
}


async function initializePriceConnection() {
  try {
    // if (sessionRefreshInterval) {
    //   clearInterval(sessionRefreshInterval);
    // }

    sessionTokens = await createSession();
    if (!sessionTokens) {
      throw new Error('Failed to create session');
    }

    await connectToPriceWebSocket(sessionTokens);

    // // Step 3: Set up session refresh
    // sessionRefreshInterval = setInterval(async () => {
    //   console.log('Refreshing session...');
    //   const newTokens = await createSession();
    //   if (newTokens) {
    //     sessionTokens = newTokens;
    //     // Reconnect WebSocket with new tokens if needed
    //     if (!priceSocket || priceSocket.readyState !== WebSocket.OPEN) {
    //       connectToPriceWebSocket(sessionTokens);
    //     }
    //   }
    // }, SESSION_REFRESH_TIME);

  } catch (error) {
    console.error('Initialization failed:', error);
    updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: خطأ في الاتصال');
    setTimeout(initializePriceConnection, 5000);
  }
}

async function createSession() {
  updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: جاري إنشاء الجلسة');
  
  try {
    const res = await fetch("https://api-capital.backend-capital.com/api/v1/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CAP-API-KEY": "NNV5c5NHnrRD5W1k"
      },
      body: JSON.stringify({
        identifier: "Morialbadwi@gmail.com",
        password: "Gg-0537764776"
      })
    });

    if (!res.ok) {
      throw new Error(`Session creation failed with status: ${res.status}`);
    }

    // Extract tokens from headers
    const cst = res.headers.get("cst");
    const securityToken = res.headers.get("x-security-token");

    if (!cst || !securityToken) {
      throw new Error('Missing session tokens in response headers');
    }

    updateConnectionStatus(priceConnectionStatusElement, true, 'حالة السعر: جلسة نشطة');
    return { cst, securityToken };

  } catch (error) {
    console.error('Session creation error:', error);
    updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: فشل إنشاء الجلسة');
    return null;
  }
}

async function connectToPriceWebSocket(tokens) {
  updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: جاري الاتصال...');
  
  try {
    // Close existing connection if any
    if (priceSocket) {
      priceSocket.close();
    }

    priceSocket = new WebSocket("wss://api-streaming-capital.backend-capital.com/connect");

    priceSocket.onopen = () => {
      console.log('WebSocket connected, subscribing to gold prices v1.0.2');
      updateConnectionStatus(priceConnectionStatusElement, true, 'حالة السعر: متصل بأسعار الذهب');
      
      priceSocket.send(JSON.stringify({
        destination: "marketData.subscribe",
        correlationId: "gold-price-subscription",
        cst: tokens.cst,
        securityToken: tokens.securityToken,
        payload: {
          epics: ["GOLD"]
        }
      }));
    };

    priceSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.status === 'OK' && msg.destination === 'quote' && msg.payload) {
          const realPrice = msg.payload.bid;
          
          if (typeof realPrice === 'number' && !isNaN(realPrice)) {
            const fluctuationRange = getFluctuationRange();
            currentGoldPrice = isFluctuationEnabled 
              ? addFluctuation(realPrice, fluctuationRange)
              : realPrice;
            console.log(`Real Price: ${realPrice}`);
            updateMainPriceDisplay();
          }
        }
      } catch (error) {
        console.error('Error processing price message:', error);
      }
    };

    priceSocket.onclose = () => {
      updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: انقطع الاتصال');
      setTimeout(() => initializePriceConnection(), 3000);
    };

    priceSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: خطأ في الاتصال');
    };

  } catch (error) {
    console.error('WebSocket connection error:', error);
    updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: فشل الاتصال');
    setTimeout(() => initializePriceConnection(), 5000);
  }
}

function addFluctuation(basePrice, range) {
  const fluctuation = (Math.random() * range * 2) - range;
  return basePrice + fluctuation;
}

function updateMainPriceDisplay() {
  if (currentWeight > 0 && currentGoldPrice > 0) {
    let finalPrice = 0;
    const buyDiscount = getBuyDiscount();
    if (goldMode === 'sell') {
      // Original sell logic
      const price24K = (currentGoldPrice * 121.5) / 1000;
      const purityMultiplier = karatMultipliers[selectedKarat];
      const goldValueKarat = price24K * purityMultiplier;
      const manufacturingFee = getManufacturingFee(selectedKarat, currentWeight);
      const taxRate = selectedKarat === 24 ? 1 : 1.15;
      const manufacturingCost = (goldValueKarat + manufacturingFee) * currentWeight;
      finalPrice = manufacturingCost * taxRate;
    } else if (goldMode === 'buy') {
      // Buy logic: subtract buyDiscount SAR per gram from live price, then multiply by weight
      const price24K = (currentGoldPrice * 121.5) / 1000;
      const purityMultiplier = karatMultipliers[selectedKarat];
      const goldValueKarat = price24K * purityMultiplier;
      finalPrice = ( goldValueKarat - buyDiscount ) * currentWeight;
    }
    const difference = finalPrice - (previousPrice + 0.001);
    const color = difference < 0 ? '#F43F5E' : '#10B981';
    priceValueElement.textContent = finalPrice.toFixed(2);
    priceValueElement.style.color = color;
    priceValueElement.className = 'pricee';
    priceCurrencyElement.style.color = color;
    if (difference < 0) {
      priceArrowElement.innerHTML = '▼';
      priceArrowElement.className = 'arrow down';
    } else if (difference > 0) {
      priceArrowElement.innerHTML = '▲';
      priceArrowElement.className = 'arrow up';
    } else {
      priceArrowElement.innerHTML = '-';
      priceArrowElement.className = 'arrow';
    }
    previousPrice = finalPrice;
  } else {
    priceValueElement.textContent = '--.--';
    priceValueElement.className = 'price-placeholder';
    priceArrowElement.innerHTML = '-';
    priceArrowElement.className = 'arrow';
    priceCurrencyElement.style.color = '';
  }
}


// function updateGoldPriceDisplay(price) {
//   goldPriceElement.textContent = `سعر الذهب العالمي: $${price.toFixed(2)} للأونصة`;
// }


function selectKarat(karat) {
  selectedKarat = karat;

  document.querySelectorAll('.karat-box').forEach(function(box) {
    box.classList.remove('active');
  });
  document.getElementById('karat-' + karat).classList.add('active');
 
  updateMainPriceDisplay();
}
window.selectKarat = selectKarat;

function updateConnectionStatus(element, connected, message) {
  element.textContent = message;
  element.classList.remove(connected ? 'disconnected' : 'connected');
  element.classList.add(connected ? 'connected' : 'disconnected');
}

window.setGoldMode = function(mode) {
  if (mode === 'buy' || mode === 'sell') {
    goldMode = mode;
    updateModeUI();
    updateMainPriceDisplay();
  }
};

function updateModeUI() {

  const karat24 = document.getElementById('karat-24');
  karat24.style.display = 'flex';
}

/*----------------------DEFAULT_MANUFACTURING_SETTINGS------------------------------*/ 

const DEFAULT_MANUFACTURING_SETTINGS = {
  "18": [
    { from: 0, to: 1, fee: 200 },
    { from: 1, to: 2, fee: 200 },
    { from: 2, to: 3, fee: 175 },
    { from: 3, to: 4, fee: 150 },
    { from: 4, to: 5, fee: 125 },
    { from: 5, to: 1000, fee: 100 }
  ],
  "21": [
    { from: 0, to: 1, fee: 200 },
    { from: 1, to: 2, fee: 175 },
    { from: 2, to: 3, fee: 150 },
    { from: 3, to: 4, fee: 125 },
    { from: 4, to: 5, fee: 100 },
    { from: 5, to: 1000, fee: 75 }
  ],
  "24": [
    { from: 0, to: 1, fee: 100 },
    { from: 1, to: 2.5, fee: 100 },
    { from: 2.5, to: 5, fee: 100 },
    { from: 5, to: 1000, fee: 200 }
  ]
};

let manufacturingSettings = loadManufacturingSettings();

function loadManufacturingSettings() {
  const saved = localStorage.getItem('goldManufacturingSettings');
  return saved ? JSON.parse(saved) : {...DEFAULT_MANUFACTURING_SETTINGS};
}

function saveManufacturingSettings() {
  localStorage.setItem('goldManufacturingSettings', JSON.stringify(manufacturingSettings));
}

function getManufacturingFee(karat, weight) {
  const ranges = manufacturingSettings[karat.toString()];
  for (const range of ranges) {
    if (weight >= range.from && weight <= range.to) {
      return range.fee;
    }
  }
  return ranges[ranges.length - 1].fee;
}

function getBuyDiscount() {
  const saved = localStorage.getItem('buyDiscount');
  return saved !== null ? parseFloat(saved) : DEFAULT_BUY_DISCOUNT;
}

function getFluctuationRange() {
  const saved = localStorage.getItem('fluctuationRange');
  return saved !== null ? parseFloat(saved) : DEFAULT_FLUCTUATION_RANGE;
}
