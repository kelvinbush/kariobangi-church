"use client";

import { UserButton } from "@clerk/nextjs";

export default function NoRolePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#f9f8f6' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: '#f4f4f5' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c6f5a" strokeWidth="1.5">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h1 className="text-xl mb-3" style={{ color: '#1a1a1a' }}>
          Account Pending Setup
        </h1>
        
        <p className="text-sm mb-6 leading-relaxed" style={{ color: '#5a5a5a' }}>
          Your account has been created but you don't have a role assigned yet. 
          Please contact the system administrator to get access.
        </p>
        
        <div className="p-4 rounded-xl border mb-6 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#e8e6e3' }}>
          <p className="text-xs mb-2" style={{ color: '#9a9997' }}>What to do:</p>
          <ul className="text-sm space-y-2" style={{ color: '#5a5a5a' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: '#7c6f5a' }}>1.</span>
              Contact the church admin or IT team
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: '#7c6f5a' }}>2.</span>
              Provide your email and requested role
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: '#7c6f5a' }}>3.</span>
              Wait for role assignment confirmation
            </li>
          </ul>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <UserButton />
          <span className="text-sm" style={{ color: '#9a9997' }}>Sign out to switch accounts</span>
        </div>
      </div>
    </div>
  );
}
