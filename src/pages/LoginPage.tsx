import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  const handleNumber = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => navigate('/stocks'), 300);
      }
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['•', '0', '⌫'],
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top section */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-8">
        <div className="mb-4 flex w-full items-center justify-between">
          <GrowwLogo size={32} />
          <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">U</div>
          </div>
        </div>

        <h1 className="mb-1 text-center text-lg font-semibold text-foreground">Hi, Paper Trader</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">Enter your Groww PIN</p>

        {/* PIN display */}
        <div className="mb-6 flex gap-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold transition-colors ${
                pin.length > i
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-transparent'
              }`}
            >
              {pin.length > i ? '•' : ''}
            </div>
          ))}
        </div>

        <button className="text-sm font-medium text-primary">Use fingerprint</button>
      </div>

      {/* Numpad */}
      <div className="px-6 pb-8">
        {numpad.map((row, ri) => (
          <div key={ri} className="flex justify-around py-3">
            {row.map(key => (
              <button
                key={key}
                onClick={() => {
                  if (key === '⌫') handleDelete();
                  else if (key === '•') { /* do nothing */ }
                  else handleNumber(key);
                }}
                className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium transition-colors ${
                  key === '•'
                    ? 'text-transparent'
                    : 'text-foreground active:bg-muted'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginPage;
