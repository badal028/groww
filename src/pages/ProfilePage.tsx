import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Wallet, Package, User, Building2, Share2, Headphones, FileText } from 'lucide-react';

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
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground lg:text-4xl">
              U
            </div>
          </div>
          <h1 className="text-lg font-semibold text-foreground lg:text-xl">Paper Trader</h1>
        </div>

        {/* Menu Items */}
        <div className="flex-1 px-4 lg:px-0 lg:max-w-xl">
          {menuItems.map((item, i) => (
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
