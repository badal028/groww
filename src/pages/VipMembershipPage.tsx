type Plan = {
  id: string;
  name: string;
  price: string;
  per: string;
  activeMembers: string;
  payUrl: string;
  popular?: boolean;
};

const plans: Plan[] = [
  { id: "1m", name: "1 Month", price: "2,288.00", per: "1 Month", activeMembers: "1,317 members active", payUrl: "https://payments.cashfree.com/links?code=Ma5r9jimfgk0_AAAAAAANUoY" },
  { id: "2m", name: "2 Month", price: "2,600.00", per: "2 Months", activeMembers: "933 members active", payUrl: "https://payments.cashfree.com/links?code=ha5r9sl3aibg_AAAAAAANUoY" },
  { id: "3m", name: "Quarterly Plan", price: "2,808.00", per: "3 Months", activeMembers: "2,174 members active", payUrl: "https://payments.cashfree.com/links?code=ma5r9vne5gk0_AAAAAAANUoY" },
  { id: "1y", name: "Yearly Plan", price: "3,640.00", per: "12 Months", activeMembers: "1,004 members active", payUrl: "https://payments.cashfree.com/links?code=Ba5ra3hqcibg_AAAAAAANUoY" },
  { id: "life", name: "Life Time", price: "4,680.00", per: "Life time", activeMembers: "4,451 members active", payUrl: "https://payments.cashfree.com/links?code=na5ra67kiibg_AAAAAAANUoY", popular: true },
];

const reviews = [
  { text: `"Signals are incredibly accurate. Made ₹42,000 profit in my very first month! Best trading community I've joined."`, by: "Ravi K., Mumbai" },
  { text: `"Education content is worth 10x the price. Went from beginner to confident trader in just 3 months!"`, by: "Priya S., Delhi" },
  { text: `"Always responsive in the VIP group. Live weekend sessions are extremely valuable. Everyone should join!"`, by: "Aakash T., Pune" },
  { text: `"Yearly plan is the best value for money. Consistent signals, excellent support. Worth every rupee!"`, by: "Suman R., Bangalore" },
];

function isValidCashfreeLink(url: string): boolean {
  return /^https:\/\/payments\.cashfree\.com\/links(\?code=[A-Za-z0-9_-]+|\/(?!replace-)[A-Za-z0-9_-]+)$/i.test(String(url || "").trim());
}

export default function VipMembershipPage() {
  return (
    <div className="vip-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        .vip-page{--orange:#F97316;--orange-dark:#EA580C;--orange-light:#FFF7ED;--blue:#2563EB;--green:#22C55E;--bg:#F3F4F6;--white:#FFFFFF;--text:#111827;--muted:#6B7280;--border:#E5E7EB;--card-shadow:0 1px 4px rgba(0,0,0,.08);background:var(--bg);font-family:'Nunito',sans-serif;color:var(--text);min-height:100vh}
        .vip-page *{box-sizing:border-box}
        .vip-topbar{background:var(--white);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .vip-logo{font-size:18px;font-weight:800}.vip-logo span{color:var(--orange)}
        .vip-secure{font-size:14px;font-weight:800;color:var(--green);text-align:right;display:flex;align-items:center;gap:6px}
        .vip-trust{background:var(--white);border-bottom:1px solid var(--border);padding:12px 24px;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
        .vip-chip{background:linear-gradient(180deg,#FFFFFF,#F8FAFC);border:1px solid #D8DEE8;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:800;color:#4B5563;box-shadow:0 1px 2px rgba(15,23,42,.06)}
        .vip-main{max-width:1200px;margin:24px auto;padding:0 16px;display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start}
        .vip-left,.vip-right{display:flex;flex-direction:column;gap:16px}
        .vip-hero{background:linear-gradient(145deg,#1E40AF,#2563EB,#3B82F6);border-radius:16px;padding:28px 24px;text-align:center;position:relative;overflow:hidden}
        .vip-hero:before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:rgba(255,255,255,.06);border-radius:50%}
        .vip-hero:after{content:'';position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;background:rgba(255,255,255,.04);border-radius:50%}
        .created-by{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.15);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:800;color:#fff;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px}
        .created-by:before{content:'';width:8px;height:8px;background:var(--green);border-radius:50%;box-shadow:0 0 6px var(--green)}
        .vip-badge-outer{width:110px;height:110px;border-radius:50%;background:linear-gradient(145deg,#d4a017,#f5c842,#d4a017);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 30px rgba(212,160,23,.5),0 0 0 6px rgba(212,160,23,.15)}
        .vip-badge-inner{width:88px;height:88px;border-radius:50%;background:linear-gradient(145deg,#1a3a8f,#1e4fd8);display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px solid rgba(212,160,23,.4)}
        .vip-text{font-size:18px;font-weight:800;color:#fff;letter-spacing:2px;line-height:1}
        .premium-text{font-size:7px;color:rgba(255,255,255,.8);letter-spacing:1.5px;text-transform:uppercase;line-height:1.4}
        .edu-chip{display:inline-flex;background:rgba(255,255,255,.2);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;color:#fff}
        .live-members{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:10px;margin-top:10px}
        .live-dot{width:9px;height:9px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);animation:blink 1.5s infinite}
        .live-label{font-size:11px;color:rgba(255,255,255,.7);font-weight:700;letter-spacing:1px;text-transform:uppercase}
        .live-count{font-size:26px;font-weight:800;color:#fff;line-height:1}
        .card{background:var(--white);border-radius:14px;padding:20px;box-shadow:var(--card-shadow);border:1px solid var(--border)}
        .disc-box{background:#F9FAFB;border:1px solid var(--border);border-radius:10px;padding:14px}
        .disc-box p{font-size:12px;color:var(--muted);line-height:1.6}
        .pay-icons{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
        .pay-icon{background:#F3F4F6;border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;color:var(--muted)}
        .pay-icon.highlight{background:#EFF6FF;color:var(--blue);border-color:#BFDBFE}.pay-icon.orange{background:var(--orange-light);color:var(--orange);border-color:#FED7AA}
        .plans-header{background:var(--white);border-radius:14px;padding:18px 22px;box-shadow:var(--card-shadow);border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
        .plans-list{display:flex;flex-direction:column;gap:12px}
        .plan-row{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--card-shadow);position:relative;overflow:hidden;gap:14px}
        .plan-row:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--border)}
        .plan-row.popular{border:2px solid var(--orange);box-shadow:0 4px 20px rgba(249,115,22,.15)}.plan-row.popular:before{background:var(--orange);width:5px}
        .popular-tag{position:absolute;top:12px;right:100px;background:linear-gradient(90deg,var(--orange),var(--orange-dark));color:#fff;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:20px}
        .plan-name{font-size:16px;font-weight:700;margin-bottom:4px}.plan-row.popular .plan-name{color:var(--orange)}
        .plan-price{font-size:22px;font-weight:800}.plan-per{font-size:13px;color:var(--muted)}.plan-active{font-size:12px;color:var(--green);font-weight:700;margin-top:5px}
        .buy-btn{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(90deg,var(--orange),var(--orange-dark));color:#fff;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:800;text-decoration:none;white-space:nowrap;box-shadow:0 4px 14px rgba(249,115,22,.3)}
        .features-row{background:var(--white);border-radius:14px;border:1px solid var(--border);box-shadow:var(--card-shadow);display:grid;grid-template-columns:repeat(4,1fr);overflow:hidden}
        .feat-item{text-align:center;padding:20px 16px;border-right:1px solid var(--border)}.feat-item:last-child{border-right:none}
        .reviews-card{background:var(--white);border-radius:14px;border:1px solid var(--border);box-shadow:var(--card-shadow);padding:20px 22px}
        .reviews-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.review-item{background:#F9FAFB;border:1px solid var(--border);border-radius:10px;padding:14px}
        .review-stars{color:#F59E0B;font-size:12px;margin-bottom:8px}.review-text{font-size:12px;color:var(--muted);line-height:1.6;font-style:italic;margin-bottom:10px}.review-author{font-size:12px;font-weight:700}
        .buy-btn-disabled{background:#9CA3AF !important;box-shadow:none !important;cursor:not-allowed}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
        @media (max-width:768px){.vip-topbar{padding:12px 14px;align-items:center;flex-direction:row;justify-content:space-between}.vip-logo{font-size:21px;line-height:1.05;white-space:nowrap}.vip-secure{text-align:right;font-size:12px;white-space:nowrap}.vip-main{grid-template-columns:1fr}.vip-left{display:none}.vip-trust{display:none}.features-row{grid-template-columns:repeat(2,1fr)}.reviews-grid{grid-template-columns:1fr}.vip-chip{font-size:11px;padding:8px 12px}.popular-tag{position:static;display:inline-block;margin-bottom:8px}.plan-row{display:block}.buy-btn{margin-top:12px;width:100%}}
      `}</style>

      <div className="vip-topbar">
        <div className="vip-logo">VIP <span>Premium</span> Member</div>
        <div className="vip-secure">🔒 100% Secure</div>
      </div>

      <div className="vip-trust">
        <div className="vip-chip">🔒 256-bit SSL</div>
        <div className="vip-chip">⚡ Instant Access</div>
        <div className="vip-chip">✅ Verified Creator</div>
        <div className="vip-chip">🇮🇳 India Trusted</div>
        <div className="vip-chip">💬 24/7 Support</div>
      </div>

      <div className="vip-main">
        <div className="vip-left">
          <div className="vip-hero">
            <div className="created-by">Created By</div>
            <div className="vip-badge-outer">
              <div className="vip-badge-inner">
                <div className="vip-text">VIP</div>
                <div className="premium-text">PREMIUM<br />MEMBERSHIP</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="edu-chip">Education</div>
            </div>
            <div className="live-members">
              <div className="live-dot" />
              <div>
                <div className="live-label">Live Members</div>
                <div className="live-count">9,798</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Description</h3>
            <div className="disc-box">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Disclaimer</div>
              <p>
                Join our exclusive VIP Membership to unlock premium features, expert insights, and high-value content designed
                to help you grow faster and smarter.
              </p>
              <p style={{ marginTop: 8 }}>
                No demo/trial. Refund policy not available. Pay via link and send screenshot for manual premium-group approval.
              </p>
            </div>
          </div>

          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              Guaranteed <strong style={{ color: "#22C55E" }}>safe</strong> and <span style={{ color: "#F97316" }}>secure</span> payment
            </div>
            <div className="pay-icons">
              <div className="pay-icon">PhonePe</div>
              <div className="pay-icon">Mastercard</div>
              <div className="pay-icon orange">Paytm</div>
              <div className="pay-icon highlight">GPay</div>
              <div className="pay-icon">UPI</div>
              <div className="pay-icon">Rupay</div>
            </div>
          </div>
        </div>

        <div className="vip-right">
          <div className="plans-header">
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>Choose Your Plan</h2>
            <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>5 Plans Available</div>
          </div>

          <div className="plans-list">
            {plans.map((plan) => (
              <div className={`plan-row ${plan.popular ? "popular" : ""}`} key={plan.id}>
                {plan.popular ? <div className="popular-tag">Most Popular</div> : null}
                <div>
                  <div className="plan-name">{plan.name}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <div className="plan-price">₹{plan.price}</div>
                    <div className="plan-per">/ {plan.per}</div>
                  </div>
                  <div className="plan-active">{plan.activeMembers}</div>
                </div>
                {isValidCashfreeLink(plan.payUrl) ? (
                  <a href={plan.payUrl} target="_blank" rel="noreferrer" className="buy-btn">
                    Buy Now
                  </a>
                ) : (
                  <button type="button" className="buy-btn buy-btn-disabled" title="Set real Cashfree link in code">
                    Link not set
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="features-row">
            <div className="feat-item"><div style={{ fontSize: 26 }}>Live</div><div style={{ fontSize: 13, fontWeight: 700 }}>Live Signals</div><div style={{ fontSize: 11, color: "#6B7280" }}>Real-time alerts</div></div>
            <div className="feat-item"><div style={{ fontSize: 26 }}>Edu</div><div style={{ fontSize: 13, fontWeight: 700 }}>Education</div><div style={{ fontSize: 11, color: "#6B7280" }}>Expert sessions</div></div>
            <div className="feat-item"><div style={{ fontSize: 26 }}>VIP</div><div style={{ fontSize: 13, fontWeight: 700 }}>VIP Group</div><div style={{ fontSize: 11, color: "#6B7280" }}>Private Telegram</div></div>
            <div className="feat-item"><div style={{ fontSize: 26 }}>SSL</div><div style={{ fontSize: 13, fontWeight: 700 }}>Secure Pay</div><div style={{ fontSize: 11, color: "#6B7280" }}>256-bit SSL</div></div>
          </div>

          <div className="reviews-card">
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>What Members Say</h3>
            <div className="reviews-grid">
              {reviews.map((r) => (
                <div className="review-item" key={`${r.by}-${r.text.slice(0, 20)}`}>
                  <div className="review-stars">★★★★★</div>
                  <p className="review-text">{r.text}</p>
                  <div className="review-author">- {r.by}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
