
export async function createSession({onStatusChange}) {
  if (onStatusChange) onStatusChange(false, 'حالة السعر: جاري إنشاء الجلسة');
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
    if (!res.ok) throw new Error(`Session creation failed with status: ${res.status}`);
    const cst = res.headers.get("cst");
    const securityToken = res.headers.get("x-security-token");
    if (!cst || !securityToken) throw new Error('Missing session tokens in response headers');
    if (onStatusChange) onStatusChange(true, 'حالة السعر: جلسة نشطة');
    return { cst, securityToken };
  } catch (error) {
    console.error('Session creation error:', error);
    if (onStatusChange) onStatusChange(false, 'حالة السعر: فشل إنشاء الجلسة');
    return null;
  }
}

export function connectToGoldPriceWebSocket({tokens, onPriceUpdate, onStatusChange, onSessionExpired}) {
  let priceSocket = null;
  function updateConnectionStatus(connected, message) {
    if (onStatusChange) onStatusChange(connected, message);
  }
  function startConnection() {
    updateConnectionStatus(false, 'حالة السعر: جاري الاتصال...');
    try {
      if (priceSocket && typeof priceSocket.close === 'function') priceSocket.close();
      priceSocket = new WebSocket("wss://api-streaming-capital.backend-capital.com/connect");
      priceSocket.onopen = () => {
        updateConnectionStatus(true, 'حالة السعر: متصل بأسعار الذهب');
        priceSocket.send(JSON.stringify({
          destination: "marketData.subscribe",
          correlationId: "gold-price-subscription",
          cst: tokens.cst,
          securityToken: tokens.securityToken,
          payload: { epics: ["GOLD"] }
        }));
      };
      priceSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.status === 'OK' && msg.destination === 'quote' && msg.payload) {
            const realPrice = msg.payload.bid;
            if (typeof realPrice === 'number' && !isNaN(realPrice) && onPriceUpdate) {
              onPriceUpdate(realPrice);
            }
          }
        } catch (error) {
          console.error('Error processing price message:', error);
        }
      };
      priceSocket.onclose = () => {
        updateConnectionStatus(false, 'حالة السعر: انقطع الاتصال');
        if (onSessionExpired) onSessionExpired();
        setTimeout(startConnection, 3000);
      };
      priceSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false, 'حالة السعر: خطأ في الاتصال');
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      updateConnectionStatus(false, 'حالة السعر: فشل الاتصال');
      setTimeout(startConnection, 5000);
    }
  }
  startConnection();
  return {
    close: () => priceSocket && priceSocket.close()
  };
} 
