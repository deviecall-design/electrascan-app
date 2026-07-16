import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';

interface LicenseContextType {
  isLicensed: boolean;
  licenseExpiration: Date | null;
  checkingLicense: boolean;
  refreshLicense: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const LicenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLicensed, setIsLicensed] = useState(false);
  const [checkingLicense, setCheckingLicense] = useState(true);

  const checkApproval = async () => {
    setCheckingLicense(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setIsLicensed(false);
        return;
      }
      const { data, error } = await supabase
        .from('approved_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      setIsLicensed(!error && data !== null);
    } catch {
      setIsLicensed(false);
    } finally {
      setCheckingLicense(false);
    }
  };

  useEffect(() => {
    checkApproval();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkApproval();
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <LicenseContext.Provider value={{
      isLicensed,
      licenseExpiration: null,
      checkingLicense,
      refreshLicense: checkApproval,
    }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};
