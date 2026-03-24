import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Wallet, Package, User, Building2, Share2, Headphones, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || 'http://127.0.0.1:3001';

const menuItems = [
  { icon: Wallet, label: '$0.00', sublabel: 'Stocks, F&O balance', action: 'Add money', actionColor: true },
  { icon: Package, label: 'Orders', sublabel: '' },
  { icon: User, label: 'Account Details', sublabel: '' },
  { icon: Building2, label: 'Banks & Autopay', sublabel: '' },
  { icon: Share2, label: 'Refer', action: 'Invite', actionColor: true },
  { icon: Headphones, label: 'Customer Support 24x7', sublabel: '' },
  { icon: FileText, label: 'Reports', sublabel: '' },
];

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, token, refreshMe, updateProfile } = useAuth();
  const [adding, setAdding] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const initials = useMemo(() => {
    const src = String(user?.name || 'User');
    const parts = src.split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : src.slice(0, 2).toUpperCase();
  }, [user?.name]);
  const walletLabel = `₹${Number(user?.walletInr ?? 0).toLocaleString('en-IN')}`;
  const realWalletLabel = `₹${Number(user?.realWalletInr ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const userMenuItems = menuItems.map((item) =>
    item.icon === Wallet
      ? { ...item, label: walletLabel }
      : item,
  );

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-8">
        <button onClick={() => navigate(-1)} className="text-foreground lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="hidden lg:block text-2xl font-bold text-foreground">Profile</h1>
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <div className="lg:flex lg:gap-8 lg:px-8 lg:py-6">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center py-6 lg:py-0 lg:w-64 lg:flex-shrink-0">
          <div className="mb-3 h-20 w-20 overflow-hidden rounded-full bg-muted lg:h-28 lg:w-28">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground lg:text-4xl">
                {initials}
              </div>
            )}
          </div>
          <button
            type="button"
            className="mb-2 text-xs font-medium text-primary underline"
            onClick={async () => {
              const next = window.prompt('Paste profile image URL');
              if (next == null) return;
              const r = await updateProfile({ avatarUrl: next });
              if (!r.ok) toast.error(r.message || 'Could not update avatar');
              else toast.success('Profile icon updated');
            }}
          >
            Update profile icon
          </button>
          <h1 className="text-lg font-semibold text-foreground lg:text-xl">{user?.name || 'Paper Trader'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
        </div>

        {/* Menu Items */}
        <div className="flex-1 px-4 lg:px-0 lg:max-w-xl">
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Real balance</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{realWalletLabel}</p>
              </div>
              <button
                type="button"
                disabled={adding}
                onClick={async () => {
                  const val = window.prompt('Enter amount to add (INR)', '100');
                  if (!val) return;
                  const amt = Number(val);
                  if (!Number.isFinite(amt) || amt <= 0) {
                    toast.error('Invalid amount');
                    return;
                  }
                  if (!token) {
                    toast.error('Login required');
                    return;
                  }
                  setAdding(true);
                  try {
                    const checkoutExists = !!(window as any).Razorpay;
                    if (!checkoutExists) {
                      await new Promise<void>((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        s.async = true;
                        s.onload = () => resolve();
                        s.onerror = () => reject(new Error('Could not load Razorpay checkout'));
                        document.body.appendChild(s);
                      });
                    }

                    const orderRes = await fetch(`${apiBase}/payments/razorpay/order`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ amountInr: amt }),
                    });
                    const orderData = await orderRes.json().catch(() => ({}));
                    if (!orderRes.ok) throw new Error(orderData?.message || 'Could not create payment order');

                    const RazorpayCtor = (window as any).Razorpay;
                    if (!RazorpayCtor) throw new Error('Razorpay SDK unavailable');

                    await new Promise<void>((resolve, reject) => {
                      const rzp = new RazorpayCtor({
                        key: orderData.keyId,
                        amount: orderData.order.amount,
                        currency: orderData.order.currency,
                        name: 'GrowwTrader',
                        description: 'Add money to real balance',
                        order_id: orderData.order.id,
                        prefill: {
                          name: user?.name || '',
                          email: user?.email || '',
                        },
                        handler: async (response: any) => {
                          try {
                            const verifyRes = await fetch(`${apiBase}/payments/razorpay/verify`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                ...response,
                                amountInr: amt,
                              }),
                            });
                            const verifyData = await verifyRes.json().catch(() => ({}));
                            if (!verifyRes.ok) throw new Error(verifyData?.message || 'Payment verification failed');
                            await refreshMe();
                            toast.success(`Added ₹${amt.toLocaleString('en-IN')} to real balance`);
                            resolve();
                          } catch (e) {
                            reject(e);
                          }
                        },
                        modal: {
                          ondismiss: () => reject(new Error('Payment cancelled')),
                        },
                        theme: { color: '#22c55e' },
                      });
                      rzp.open();
                    });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Add money failed');
                  } finally {
                    setAdding(false);
                  }
                }}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {adding ? 'Adding...' : 'Add money'}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Contest entry fee is deducted from real balance.</p>
            <button
              type="button"
              disabled={withdrawing || !token}
              onClick={async () => {
                const val = window.prompt('Withdraw amount (INR)', '100');
                if (!val) return;
                const amt = Number(val);
                if (!Number.isFinite(amt) || amt <= 0) {
                  toast.error('Invalid amount');
                  return;
                }
                setWithdrawing(true);
                try {
                  const res = await fetch(`${apiBase}/wallet/withdraw/request`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ amountInr: amt }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data?.message || 'Withdraw request failed');
                  await refreshMe();
                  toast.success('Withdraw request submitted. Admin approval pending.');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Withdraw failed');
                } finally {
                  setWithdrawing(false);
                }
              }}
              className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
            >
              {withdrawing ? 'Submitting...' : 'Request withdraw'}
            </button>
          </div>

          {userMenuItems.map((item, i) => (
            <button
              key={i}
              className="flex w-full items-center justify-between border-b border-border py-4 text-left hover:bg-muted/50 transition-colors rounded px-2 -mx-2"
            >
              <div className="flex items-center gap-4">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.sublabel && <p className="text-xs text-muted-foreground">{item.sublabel}</p>}
                </div>
              </div>
              {item.action && (
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  item.actionColor ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                }`}>
                  {item.action}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="mt-6 w-full rounded-lg border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground lg:px-8">
        <span>About Us</span>
        <span>Version 1.0.0</span>
        <span>Charges</span>
      </div>
    </div>
  );
};

export default ProfilePage;
