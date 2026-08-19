import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GrowwLogo from '@/components/GrowwLogo';

const SplashScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/login'), 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-pulse-green">
        <GrowwLogo size={64} />
      </div>
    </div>
  );
};

export default SplashScreen;
