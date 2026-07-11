const { getPaymentGateway } = require('/opt/ai-agent-platform/server/dist/services/payment.service.js');
(async () => {
  const orderNo = 'TEST' + Date.now();
  try {
    const wx = getPaymentGateway('wechat');
    const r = await wx.createOrder({ orderNo, amount: 100, currency: 'CNY', description: 'verify' });
    console.log('WECHAT_OK codeUrl=', (r.payParams && r.payParams.codeUrl || '').slice(0, 50));
  } catch (e) { console.log('WECHAT_ERR', e.message); }
  try {
    const al = getPaymentGateway('alipay');
    const r = await al.createOrder({ orderNo, amount: 100, currency: 'CNY', description: 'verify' });
    console.log('ALIPAY_OK', JSON.stringify(r).slice(0, 120));
  } catch (e) { console.log('ALIPAY_ERR', e.message); }
})();
