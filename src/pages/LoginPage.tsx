import React, { useState, useEffect } from 'react';
import { login, signup } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './LoginPage.css';
import { useLanguage } from '../contexts/LanguageContext';

const LoginPage: React.FC = () => {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('User already logged in, redirecting...');
                navigate('/map');
            }
        });
        return () => unsub();
    }, [navigate]);

    const handleGoogleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            // Auth state listener will handle redirect
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await signup(email, password);
            }
            navigate('/map');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="brand-section">
                    <h1 className="brand-title">TezLink</h1>
                    <p className="brand-subtitle">{t('chustSlogan')}</p>
                    <div className="invitation-badge">
                        <span>{t('invitationOnly')}</span>
                    </div>
                    <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                        {t('bottomTagline')}
                    </p>
                </div>

                {error && <div className="error-msg">{error}</div>}

                <button className="google-btn" onClick={handleGoogleLogin}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 20 }} />
                    <span>{t('googleSignIn')}</span>
                </button>

                <div className="divider">
                    <div className="line"></div>
                    <span className="divider-text">{t('orEmail')}</span>
                    <div className="line"></div>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            type="email"
                            placeholder={t('emailPlaceholder')}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder={t('passwordPlaceholder')}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="submit-btn">
                        {isLogin ? t('loginButton') : t('signupButton')}
                    </button>
                </form>

                <button className="toggle-link" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? t('toggleLogin') : t('toggleSignup')}
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
