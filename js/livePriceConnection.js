const SUPABASE_URL = "https://rccdojokxkzljkimvdag.supabase.co/rest/v1";
const SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjY2Rvam9reGt6bGpraW12ZGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2NjI5MTQsImV4cCI6MjA2NzIzODkxNH0.8PRQYgls09sKNNJZk9_HuwSCHjTUxDQM4RpRwkS5MQk";

const REST_HEADERS = {
  apikey: SUPABASE_API_KEY,
  Authorization: `Bearer ${SUPABASE_API_KEY}`,
  "Content-Type": "application/json"
}


export async function checkSubscription(mac) {
 
  const url = `${SUPABASE_URL}/devices?select=start_date,end_date,is_subscribed&mac_address=eq.${encodeURIComponent(mac)}`
  const res = await fetch(url, { headers: REST_HEADERS })
  if (!res.ok) throw new Error("فشل في جلب حالة الجهاز")
    const [device] = await res.json()
  if (!device) {
    updateConnectionStatus(priceConnectionStatusElement, false, "الجهاز غير مسجل");
    throw new Error("الجهاز غير مسجل")
  }
  const now = new Date();
  const start = new Date(device.start_date);
  const end = new Date(device.end_date);

  return device.is_subscribed
      && start <= now
      && end   >= now
}


export async function fetchTokensFromSupabase() {
  try {

    const resp = await fetch(
      `${SUPABASE_URL}/configuration?id=eq.1&select=cst,token`,
      { headers: REST_HEADERS }
    )
    if (!resp.ok) throw new Error("فشل في جلب التوكن")
    const data = await resp.json()
    const { cst, token: securityToken } = data[0] || {}
    if (!cst || !securityToken) throw new Error("توكنات غير صالحة")

    localStorage.setItem("gold_cst", cst)
    localStorage.setItem("gold_token", securityToken)
    return { cst, securityToken }

  } catch (error) {
    console.error(error)
    window.location.href = "/renew.html"
    return null
  }
}


export async function checkGoldMarketStatus() {
  const cst = localStorage.getItem("gold_cst");
  const token = localStorage.getItem("gold_token");

  if (!cst || !token) {
    console.warn("Gold session tokens not found.");
    return { status: "NO_SESSION" };
  }

  try {
    const res = await fetch("https://api-capital.backend-capital.com/api/v1/markets/GOLD", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        CST: cst,
        "X-SECURITY-TOKEN": token,
      },
    });

    const data = await res.json();

    if (data.errorCode === "error.invalid.session.token") {
      console.warn("Session expired, tokens removed --- checkGoldMarketStatus");
      return { status: "SESSION_EXPIRED" };
    }

    const marketStatus = data?.snapshot?.marketStatus;
    const bidPrice = data?.snapshot?.bid;

    return {
      status: marketStatus === "TRADEABLE" ? "OPEN" : "CLOSED",
      bid: bidPrice,
    };
  } catch (error) {
    console.error("Error checking gold market status:", error);
    return { status: "ERROR" };
  }
}

export function connectToGoldPriceWebSocket({ onPriceUpdate, onStatusChange, onSessionExpired }) {
  let priceSocket = null;

  async function restartConnection() {
    const newTokens = await fetchTokensFromSupabase();
    if (newTokens) {
      connectToGoldPriceWebSocket({ onPriceUpdate, onStatusChange, onSessionExpired });
    } else {
      console.error("Failed to restart WebSocket due to missing tokens");
      setTimeout(restartConnection, 3000);
    }
  }

  function getStoredTokens() {
    const cst = localStorage.getItem("gold_cst");
    const securityToken = localStorage.getItem("gold_token");
    return cst && securityToken ? { cst, securityToken } : null;
  }

  async function startConnection() {
    const tokens = getStoredTokens();
    if (!tokens) return restartConnection();

    if (priceSocket) priceSocket.close();

    priceSocket = new WebSocket("wss://api-streaming-capital.backend-capital.com/connect");

    priceSocket.onopen = () => {
      onStatusChange(true, "حالة السعر: متصل بأسعار الذهب");
      priceSocket.send(
        JSON.stringify({
          destination: "marketData.subscribe",
          correlationId: "gold-price-subscription",
          cst: tokens.cst,
          securityToken: tokens.securityToken,
          payload: { epics: ["GOLD"] },
        })
      );
    };

    priceSocket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.errorCode === "error.invalid.session.token") {
        console.warn("Session expired, tokens removed --- onMessage");
        onStatusChange(false, "حالة السعر: الجلسة منتهية");
        restartConnection();
        return;
      }
      
      if (msg.status === "OK" && msg.destination === "quote" && msg.payload) {
        const realPrice = msg.payload.bid;
        if (typeof realPrice === "number") onPriceUpdate(realPrice);
      }
    };
    
    priceSocket.onclose = (event) => {
      onStatusChange(false, "حالة السعر: انقطع الاتصال");
      console.warn("webSoucket has been closed --- onClose");
      console.warn("WebSocket closed:", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      });
      if (!navigator.onLine) {
      console.warn("🚫 لا يوجد اتصال إنترنت حالياً. سيتم الانتظار حتى عودة الاتصال.");
      return; 
      }
    setTimeout(restartConnection, 3000);
    };

    priceSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      onStatusChange(false, "حالة السعر: خطأ في الاتصال");
      restartConnection();
    };
  }

  startConnection();

  return {
    close: () => priceSocket?.close(),
  };
}

window.addEventListener("online", () => {
  console.log("💡 تم استعادة الاتصال بالإنترنت، سيتم إعادة الاتصال بالسيرفر...");
  restartConnection();
});
