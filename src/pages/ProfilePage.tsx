import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Wallet, Package, User, Building2, Share2, Headphones, FileText, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const menuItems = [
  { icon: Wallet, label: '$0.00', sublabel: 'Stocks, F&O balance', action: 'Virtual balance' },
  { icon: Wallet, label: '$0.00', sublabel: 'Wallet balance', action: 'Add money', actionColor: true },
  { icon: Package, label: 'Orders', sublabel: '' },
  { icon: User, label: 'Account Details', sublabel: '' },
  { icon: Building2, label: 'Banks & Autopay', sublabel: '' },
  { icon: Share2, label: 'Refer', action: 'Invite', actionColor: true },
  { icon: Headphones, label: 'Customer Support 24x7', sublabel: '' },
  { icon: FileText, label: 'Reports', sublabel: '' },
];
const apiBase = import.meta.env.VITE_MARKET_DATA_API_BASE || 'http://127.0.0.1:3001';

const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });

const compressAvatarToDataUrl = async (file: File): Promise<string> => {
  const img = await loadImageElement(file);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing unavailable');
  ctx.drawImage(img, 0, 0, width, height);

  const out = canvas.toDataURL('image/jpeg', 0.78);
  if (!out.startsWith('data:image/')) throw new Error('Could not process image');
  return out;
};

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile, token, refreshMe } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [addAmountInput, setAddAmountInput] = useState('');
  const [addingMoney, setAddingMoney] = useState(false);
  const [cashfreeStatus, setCashfreeStatus] = useState('');
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initials = useMemo(() => {
    const src = String(user?.name || 'User');
    const parts = src.split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : src.slice(0, 2).toUpperCase();
  }, [user?.name]);
  const walletLabel = `₹${Number(user?.walletInr ?? 0).toLocaleString('en-IN')}`;
  const realWalletLabel = `₹${Number(user?.realWalletInr ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const userMenuItems = menuItems.map((item, index) => {
    if (item.icon !== Wallet) return item;
    if (index === 0) return { ...item, label: walletLabel };
    if (index === 1) return { ...item, label: realWalletLabel };
    return item;
  });

  const openAddMoney = () => {
    setAddAmountInput('');
    setAddMoneyOpen(true);
  };

  const handleAddMoney = async () => {
    const amt = Number(addAmountInput);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!token) {
      toast.error('Login required');
      return;
    }
    setAddingMoney(true);

    try {
      const orderRes = await fetch(`${apiBase}/payments/cashfree/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountInr: amt }),
      });
      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok || orderData.status !== 'ok') {
        throw new Error(orderData?.message || 'Could not create Cashfree order');
      }

      if (!orderData.paymentLink) {
        throw new Error('Cashfree did not return a payment link');
      }

      toast.success('Redirecting to Cashfree for payment...');
      window.location.href = orderData.paymentLink;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add money failed';
      toast.error(msg);
    } finally {
      setAddingMoney(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderId = params.get('cashfreeOrderId');
    if (!orderId || !token) return;

    let attempts = 0;
    let timer: number | null = null;
    let stopped = false;

    const checkStatus = async () => {
      if (stopped) return;
      attempts += 1;
      try {
        setCashfreeStatus(attempts === 1 ? 'Checking payment status...' : `Checking payment status... (${attempts})`);
        const statusRes = await fetch(`${apiBase}/payments/cashfree/status/${encodeURIComponent(orderId)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusData = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok || statusData.status !== 'ok') {
          setCashfreeStatus(statusData.message || 'Could not fetch payment status');
          return;
        }

        if (String(statusData.order?.status || '').toUpperCase() === 'PAID') {
          await refreshMe();
          setCashfreeStatus(`Payment confirmed: ₹${Number(statusData.order.amountInr || 0).toLocaleString('en-IN')} added`);
          stopped = true;
          return;
        } else {
          setCashfreeStatus(`Payment status: ${statusData.order?.status || 'PENDING'}`);
        }
      } catch (error) {
        setCashfreeStatus('Payment status check failed');
      }

      if (!stopped && attempts < 12) {
        timer = window.setTimeout(() => {
          void checkStatus();
        }, 3000);
      }
    };

    void checkStatus();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [location.search, token, refreshMe]);

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
          <div className="relative mb-3 h-20 w-20 lg:h-28 lg:w-28">
            <div className="h-full w-full overflow-hidden rounded-full bg-muted">
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
              aria-label="Edit profile icon"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground shadow"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!f.type.startsWith('image/')) {
                  toast.error('Please select an image file');
                  return;
                }
                const maxBytes = 6 * 1024 * 1024;
                if (f.size > maxBytes) {
                  toast.error('Image too large (max 6 MB)');
                  return;
                }
                setUploadingAvatar(true);
                try {
                  const dataUrl = await compressAvatarToDataUrl(f);
                  const r = await updateProfile({ avatarUrl: dataUrl });
                  if (!r.ok) toast.error(r.message || 'Could not update avatar');
                  else toast.success('Profile icon updated');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Could not update avatar');
                } finally {
                  setUploadingAvatar(false);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
          {uploadingAvatar ? (
            <p className="mb-2 text-xs text-muted-foreground">Uploading image...</p>
          ) : null}
          <h1 className="text-lg font-semibold text-foreground lg:text-xl">{user?.name || 'Paper Trader'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
          {cashfreeStatus ? (
            <p className="mt-2 text-xs font-medium text-primary">{cashfreeStatus}</p>
          ) : null}
        </div>

        {/* Menu Items */}
        <div className="flex-1 px-4 lg:px-0 lg:max-w-xl">
          {userMenuItems.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={i === 1 ? openAddMoney : undefined}
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

      <Dialog open={addMoneyOpen} onOpenChange={setAddMoneyOpen}>
        <DialogContent className="max-w-sm px-5 sm:px-6">
          <h3 className="text-base font-semibold text-foreground">Add money</h3>
          <input
            value={addAmountInput}
            onChange={(e) => setAddAmountInput(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="Amount in INR"
            className="mt-3 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm"
              onClick={() => setAddMoneyOpen(false)}
              disabled={addingMoney}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              onClick={handleAddMoney}
              disabled={addingMoney}
            >
              {addingMoney ? 'Processing...' : 'Pay now'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
