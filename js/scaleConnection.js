export function connectToWeightSocket({
  onWeightUpdate,
  onStatusChange
}) {
  let weightSocket = null;
  function updateConnectionStatus(connected, message) {
    if (onStatusChange) onStatusChange(connected, message);
  }
  function startConnection() {
    updateConnectionStatus(false, 'حالة الميزان: جاري الاتصال...');
    try {
      weightSocket = new WebSocket('ws://' + window.location.hostname + ':81/');
      weightSocket.onopen = function() {
        updateConnectionStatus(true, 'حالة الميزان: متصل');
      };
      weightSocket.onmessage = function(e) {
        const weight = parseFloat(e.data);
        if (!isNaN(weight) && onWeightUpdate) {
          onWeightUpdate(weight);
        }
      };
      weightSocket.onclose = function() {
        updateConnectionStatus(false, 'حالة الميزان: انقطع الاتصال');
        setTimeout(startConnection, 99999);
      };
      weightSocket.onerror = function(error) {
        console.error('Weight socket error:', error);
        updateConnectionStatus(false, 'حالة الميزان: خطأ في الاتصال');
      };
    } catch (error) {
      console.error('Error creating weight socket:', error);
      updateConnectionStatus(false, 'حالة الميزان: خطأ في الاتصال');
      setTimeout(startConnection, 99999);
    }
  }
  startConnection();
  return {
    close: () => weightSocket && weightSocket.close()
  };
} 
