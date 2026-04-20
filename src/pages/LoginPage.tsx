import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

export function LoginPage() {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
  const navigate = useNavigate();

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [authStatus, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="text-6xl mb-3">🎁</div>
        <h1 className="text-3xl font-bold text-gray-900">Family Wishlist</h1>
        <p className="text-gray-500 mt-2">
          Create wishlists and share them with family
        </p>
      </div>
      <div className="amplify-auth-wrapper w-full max-w-sm">
        <Authenticator
          hideSignUp={false}
          components={{
            Header() {
              return null;
            },
          }}
        />
      </div>
    </div>
  );
}
