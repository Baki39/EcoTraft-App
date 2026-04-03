import React, { useState, useRef, useEffect } from 'react';
import { Leaf, Upload, ArrowLeft, Recycle, Sparkles, Loader2, Image as ImageIcon, ChevronDown, Camera, Scan, Download, Bookmark, Trash2, Share2, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc, updateDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { Language, languages, t } from './i18n';
import { analyzeItem, generateProjectImage, AnalysisResult } from './lib/gemini';
import { LandingPage } from './components/LandingPage';
import { Logo } from './components/Logo';
import { PricingPlan } from './components/PricingPlan';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

type AppState = 'upload' | 'scanner' | 'analyzing' | 'ideas' | 'project' | 'recycle' | 'saved';

interface SavedProject {
  id: string;
  analysis: AnalysisResult;
  selectedIdeaId: string;
  originalImage: string | null;
  generatedImage: string | null;
  dateSaved: number;
}

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [appState, setAppState] = useState<AppState>('upload');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [viewSource, setViewSource] = useState<'new' | 'saved'>('new');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'trial' | 'none'>('none');
  const [analysesCount, setAnalysesCount] = useState(0);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: Date.now(),
            subscriptionStatus: 'none',
            analysesCount: 0
          });
          setAnalysesCount(0);
        } else {
          setSubscriptionStatus(userSnap.data().subscriptionStatus || 'none');
          setAnalysesCount(userSnap.data().analysesCount || 0);
        }
      } else {
        setSavedProjects([]);
        setSubscriptionStatus('none');
        setAnalysesCount(0);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setSubscriptionStatus(doc.data().subscriptionStatus || 'none');
        setAnalysesCount(doc.data().analysesCount || 0);
      }
    });

    const q = query(
      collection(db, 'users', user.uid, 'projects'),
      orderBy('dateSaved', 'desc')
    );

    const projectsUnsubscribe = onSnapshot(q, (snapshot) => {
      const projects: SavedProject[] = [];
      snapshot.forEach((doc) => {
        projects.push({ id: doc.id, ...doc.data() } as SavedProject);
      });
      setSavedProjects(projects);
    }, (error) => {
      console.error("Firestore Error: ", error);
    });

    return () => {
      userUnsubscribe();
      projectsUnsubscribe();
    };
  }, [user, isAuthReady]);

  const handleSubscribe = async (plan: 'monthly' | 'quarterly') => {
    if (!user) return;
    setIsSubscribing(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: user.uid })
      });
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.message || 'Failed to start subscription process. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSaveProject = async () => {
    if (!selectedIdea || !analysis) return;
    
    if (!user) {
      setError("Please sign in to save projects.");
      setTimeout(() => setError(null), 3000);
      signInWithGoogle();
      return;
    }

    if (savedProjects.some(p => p.selectedIdeaId === selectedIdea.id && p.analysis.itemName === analysis.itemName)) {
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
      return;
    }

    if (savedProjects.length >= 10) {
      setError(lang.storageFull);
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newProjectId = Date.now().toString();
    const newSaved = {
      userId: user.uid,
      analysis,
      selectedIdeaId: selectedIdea.id,
      originalImage: originalImage || null,
      generatedImage: generatedImages[selectedIdea.id] || null,
      dateSaved: Date.now()
    };
    
    try {
      await setDoc(doc(db, 'users', user.uid, 'projects', newProjectId), newSaved);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
    } catch (error) {
      console.error("Error saving project:", error);
      setError("Failed to save project.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleShare = async () => {
    if (!selectedIdea) return;
    
    const title = selectedIdea.title;
    const text = `${selectedIdea.title}\n\n${selectedIdea.shortDescription}\n\nMade with ${lang.appTitle}!`;
    const imageUrl = generatedImages[selectedIdea.id];

    try {
      if (imageUrl && navigator.canShare) {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], 'project.png', { type: blob.type });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text,
            files: [file]
          });
          return;
        }
      }
      
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }

      await navigator.clipboard.writeText(text);
      setShowSavedToast(true); // Reusing this toast for copied
      setTimeout(() => setShowSavedToast(false), 2000);
    } catch (err) {
      console.error("Error sharing:", err);
      // Don't alert if user just cancelled the share dialog
      const isCanceled = 
        (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('cancel'))) ||
        (typeof err === 'string' && err.toLowerCase().includes('cancel'));
        
      if (!isCanceled) {
        setError(lang.shareError);
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'projects', id));
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const openSavedProject = (project: SavedProject) => {
    setAnalysis(project.analysis);
    setSelectedIdeaId(project.selectedIdeaId);
    setOriginalImage(project.originalImage);
    if (project.generatedImage) {
      setGeneratedImages(prev => ({ ...prev, [project.selectedIdeaId]: project.generatedImage! }));
    }
    setViewSource('saved');
    setAppState('project');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lang = t[language];

  const generatingRef = useRef<Set<string>>(new Set());

  // Generate images when analysis is complete
  useEffect(() => {
    let isMounted = true;

    const generateImagesSequentially = async () => {
      if (!analysis || appState !== 'ideas') return;

      for (const idea of analysis.ideas) {
        if (!isMounted) break;

        // Check if already generated or currently generating
        if (generatedImages[idea.id] || generatingRef.current.has(idea.id)) {
          continue;
        }

        generatingRef.current.add(idea.id);
        setIsGeneratingImages(prev => ({ ...prev, [idea.id]: true }));

        try {
          const rawImageUrl = await generateProjectImage(idea.imagePrompt, originalImage || undefined);
          if (!isMounted) break;

          const imageUrl = await compressImage(rawImageUrl, 800, 800, 0.8);

          setGeneratedImages(prev => ({ ...prev, [idea.id]: imageUrl }));
          
          // Sync to saved projects if it was auto-saved
          if (user) {
            setSavedProjects(prevSaved => {
              const savedProject = prevSaved.find(p => p.selectedIdeaId === idea.id && !p.generatedImage);
              if (savedProject) {
                updateDoc(doc(db, 'users', user.uid, 'projects', savedProject.id), {
                  generatedImage: imageUrl
                }).catch(console.error);
              }
              return prevSaved;
            });
          }

          // Add a delay between successful generations to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (err) {
          console.error(`Failed to generate image for ${idea.id}:`, err);
          // If we hit a rate limit (429), wait longer before trying the next one
          await new Promise(resolve => setTimeout(resolve, 8000));
        } finally {
          if (isMounted) {
            setIsGeneratingImages(prev => ({ ...prev, [idea.id]: false }));
            generatingRef.current.delete(idea.id);
          }
        }
      }
    };

    generateImagesSequentially();

    return () => {
      isMounted = false;
    };
  }, [analysis, appState]);

  // Camera handling
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        setCameraError(false);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setCameraError(true);
      }
    };

    if (appState === 'scanner') {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [appState]);

  const processImage = async (base64String: string) => {
    const compressedImage = await compressImage(base64String);
    setOriginalImage(compressedImage);
    setAppState('analyzing');

    try {
      const parts = compressedImage.split(',');
      if (parts.length !== 2 || !parts[0].startsWith('data:')) {
        throw new Error('Invalid image format');
      }
      
      const mimeType = parts[0].split(':')[1].split(';')[0];
      const base64Data = parts[1];

      const result = await analyzeItem(base64Data, mimeType, languages[language]);
      
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          analysesCount: analysesCount + 1
        });
      }

      setAnalysis(result);
      setAppState('ideas');
    } catch (err) {
      console.error(err);
      setError(lang.analyzeError);
      setAppState('upload');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      await processImage(base64String);
    };
    reader.readAsDataURL(file);
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64String = canvas.toDataURL("image/jpeg");
    
    // Stop camera
    const stream = video.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    processImage(base64String);
  };

  const resetApp = () => {
    setAppState('upload');
    setOriginalImage(null);
    setAnalysis(null);
    setSelectedIdeaId(null);
    setGeneratedImages({});
    setIsGeneratingImages({});
    setError(null);
  };

  const handleDownloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedIdea = analysis?.ideas.find(i => i.id === selectedIdeaId);
  const isSaved = selectedIdea && analysis ? savedProjects.some(p => p.selectedIdeaId === selectedIdea.id && p.analysis.itemName === analysis.itemName) : false;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-eco animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage user={user} onSubscribe={handleSubscribe} isSubscribing={isSubscribing} />;
  }

  const showPricing = subscriptionStatus === 'none' && analysesCount >= 3 && (appState === 'upload' || appState === 'scanner');

  return (
    <div className="min-h-screen bg-dark text-zinc-50 font-sans selection:bg-selenium/30">
      {/* Header */}
      <header className="fixed top-0 w-full border-b border-zinc-800 bg-dark/80 backdrop-blur-md z-50">
        {/* Global Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-full shadow-lg z-50 whitespace-nowrap"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
            <Logo className="w-8 h-8" />
            <span className="font-semibold text-lg tracking-tight">{lang.appTitle}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <button
                onClick={logOut}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-300"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-eco/20 hover:bg-eco/30 transition-colors text-sm font-medium text-eco"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
            
            {appState !== 'upload' && appState !== 'scanner' && (
              <button
                onClick={() => {
                  setAppState('upload');
                  setAnalysis(null);
                  setOriginalImage(null);
                  setGeneratedImages({});
                  setViewSource('new');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Scan New</span>
              </button>
            )}
            <button
              onClick={() => {
                if (appState === 'ideas') {
                  setError(lang.selectProjectFirst);
                  setTimeout(() => setError(null), 3000);
                } else {
                  setAppState('saved');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors text-sm font-medium text-eco"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">{lang.savedProjects}</span>
            </button>
            
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">
                {languages[language]}
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all overflow-hidden">
                {(Object.keys(languages) as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors ${language === l ? 'text-eco' : 'text-zinc-300'}`}
                  >
                    {languages[l]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 max-w-5xl mx-auto min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* PRICING SCREEN */}
          {showPricing && (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center w-full"
            >
              <PricingPlan onSubscribe={handleSubscribe} isSubscribing={isSubscribing} />
            </motion.div>
          )}

          {/* UPLOAD SCREEN */}
          {appState === 'upload' && !showPricing && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full"
            >
              <div className="w-20 h-20 rounded-full bg-eco/10 flex items-center justify-center mb-8">
                <Sparkles className="w-10 h-10 text-eco" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                {lang.uploadTitle}
              </h1>
              <p className="text-zinc-400 text-lg mb-10">
                {lang.uploadSubtitle}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div 
                  onClick={() => setAppState('scanner')}
                  className="aspect-square md:aspect-auto md:h-48 rounded-3xl border-2 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-eco/50 transition-all cursor-pointer flex flex-col items-center justify-center group"
                >
                  <div className="w-14 h-14 rounded-full bg-zinc-800 group-hover:bg-eco/20 flex items-center justify-center mb-4 transition-colors">
                    <Camera className="w-6 h-6 text-zinc-400 group-hover:text-eco transition-colors" />
                  </div>
                  <span className="font-medium text-zinc-300 group-hover:text-eco transition-colors">
                    {lang.scanButton}
                  </span>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square md:aspect-auto md:h-48 rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-eco/50 transition-all cursor-pointer flex flex-col items-center justify-center group"
                >
                  <div className="w-14 h-14 rounded-full bg-zinc-800 group-hover:bg-eco/20 flex items-center justify-center mb-4 transition-colors">
                    <Upload className="w-6 h-6 text-zinc-400 group-hover:text-eco transition-colors" />
                  </div>
                  <span className="font-medium text-zinc-300 group-hover:text-eco transition-colors">
                    {lang.uploadButton}
                  </span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* SCANNER SCREEN */}
          {appState === 'scanner' && !showPricing && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black flex flex-col"
            >
              <button
                onClick={() => setAppState('upload')}
                className="absolute top-6 left-6 z-50 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              {cameraError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center">
                  <Camera className="w-16 h-16 text-zinc-600 mb-6" />
                  <h2 className="text-2xl font-bold mb-3">{lang.cameraDenied}</h2>
                  <p className="text-zinc-400 max-w-md">{lang.cameraDeniedSub}</p>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  
                  {/* AR Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 sm:w-80 sm:h-80 relative">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-eco rounded-tl-xl"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-eco rounded-tr-xl"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-eco rounded-bl-xl"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-eco rounded-br-xl"></div>
                      
                      {/* Scanning line animation */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-selenium shadow-[0_0_8px_2px_rgba(226,255,61,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                  
                  {/* Instructions */}
                  <div className="absolute top-24 left-0 right-0 text-center pointer-events-none">
                    <span className="bg-black/60 text-white px-6 py-3 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
                      {lang.centerObject}
                    </span>
                  </div>

                  {/* Capture Button */}
                  <div className="absolute bottom-12 left-0 right-0 flex justify-center pb-safe">
                    <button 
                      onClick={captureFromCamera}
                      className="w-20 h-20 bg-white/20 rounded-full border-4 border-white flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-all active:scale-95 cursor-pointer"
                    >
                      <div className="w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center">
                        <Scan className="w-7 h-7 text-eco" />
                      </div>
                    </button>
                  </div>
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          )}

          {/* ANALYZING SCREEN */}
          {appState === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-eco border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Logo className="w-10 h-10 animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">{lang.analyzing}</h2>
              <p className="text-zinc-500">{lang.generating}</p>
            </motion.div>
          )}

          {/* IDEAS SCREEN */}
          {appState === 'ideas' && analysis && (
            <motion.div
              key="ideas"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex flex-col"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">{lang.ideasTitle}</h2>
                <p className="text-zinc-400 text-lg max-w-2xl mx-auto">{lang.ideasSubtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {analysis.ideas.map((idea, index) => (
                  <motion.div
                    key={idea.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => {
                      setSelectedIdeaId(idea.id);
                      setAppState('project');
                      
                      // Auto-save logic
                      if (user && !savedProjects.some(p => p.selectedIdeaId === idea.id && p.analysis?.itemName === analysis.itemName)) {
                        if (savedProjects.length >= 10) {
                          setError(lang.storageFull);
                          setTimeout(() => setError(null), 3000);
                        } else {
                          const newProjectId = Date.now().toString();
                          const newSaved = {
                            userId: user.uid,
                            analysis,
                            selectedIdeaId: idea.id,
                            originalImage: originalImage || null,
                            generatedImage: generatedImages[idea.id] || null,
                            dateSaved: Date.now()
                          };
                          setDoc(doc(db, 'users', user.uid, 'projects', newProjectId), newSaved).catch(console.error);
                        }
                      }
                    }}
                    className="group cursor-pointer bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-eco/50 hover:shadow-[0_0_30px_rgba(0,230,118,0.1)] transition-all flex flex-col h-full"
                  >
                    <div className="aspect-square bg-zinc-950 relative overflow-hidden">
                      {generatedImages[idea.id] ? (
                        <img 
                          src={generatedImages[idea.id]} 
                          alt={idea.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                          <Loader2 className="w-8 h-8 animate-spin mb-3 text-eco/50" />
                          <span className="text-xs font-medium uppercase tracking-wider">{lang.generatingImage}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60"></div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-eco transition-colors">{idea.title}</h3>
                      <p className="text-zinc-400 text-sm flex-1">{idea.shortDescription}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setAppState('recycle')}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Recycle className="w-5 h-5" />
                  {lang.recycleButton}
                </button>
              </div>
            </motion.div>
          )}

          {/* PROJECT DETAIL SCREEN */}
          {appState === 'project' && selectedIdea && (
            <motion.div
              key="project"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-4xl mx-auto"
            >
              <button
                onClick={() => {
                  if (viewSource === 'saved') {
                    setAppState('saved');
                  } else {
                    setAppState('ideas');
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors w-fit cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                {lang.backButton}
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <div className="aspect-square rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-6 relative group">
                    {generatedImages[selectedIdea.id] ? (
                      <>
                        <img 
                          src={generatedImages[selectedIdea.id]} 
                          alt={selectedIdea.title} 
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleDownloadImage(generatedImages[selectedIdea.id], `${selectedIdea.title.replace(/\s+/g, '-').toLowerCase()}.png`)}
                          className="absolute bottom-4 right-4 bg-zinc-900/80 backdrop-blur-md hover:bg-eco text-white p-3 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 cursor-pointer"
                          title={lang.saveImage}
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                        <Loader2 className="w-8 h-8 animate-spin mb-3 text-eco/50" />
                        <span className="text-xs font-medium uppercase tracking-wider">{lang.generatingImage}</span>
                      </div>
                    )}
                  </div>
                  
                  {originalImage && (
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                      <img src={originalImage} alt="Original" className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">{lang.originalItem}</p>
                        <p className="text-sm font-medium">{analysis?.itemName}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h2 className="text-3xl md:text-4xl font-bold">{selectedIdea.title}</h2>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleShare}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
                        title={lang.shareProject}
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleSaveProject}
                        disabled={isSaved}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors cursor-pointer ${isSaved ? 'bg-eco/20 text-eco' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
                      >
                        <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                        <span className="hidden sm:inline">{isSaved || showSavedToast ? lang.projectSaved : lang.saveProject}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-lg mb-8">{selectedIdea.shortDescription}</p>

                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-eco">
                      <Sparkles className="w-5 h-5" />
                      {lang.materialsTitle}
                    </h3>
                    <ul className="space-y-2">
                      {selectedIdea.materials.map((mat, i) => (
                        <li key={i} className="flex items-start gap-3 text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-eco mt-2 shrink-0" />
                          <span>{mat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-eco">
                      <ImageIcon className="w-5 h-5" />
                      {lang.stepByStep}
                    </h3>
                    <div className="space-y-6">
                      {selectedIdea.instructions.map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-sm font-bold text-zinc-400">
                            {i + 1}
                          </div>
                          <p className="text-zinc-300 pt-1 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* RECYCLE SCREEN */}
          {appState === 'recycle' && analysis && (
            <motion.div
              key="recycle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-2xl mx-auto text-center"
            >
              <div className="w-24 h-24 rounded-full bg-eco/10 flex items-center justify-center mx-auto mb-8">
                <Recycle className="w-12 h-12 text-eco" />
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-8">{lang.recycleTitle}</h2>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-8 text-left">
                <p className="text-lg text-zinc-300 leading-relaxed mb-8">
                  {analysis.disposal.instructions}
                </p>
                
                <div className="bg-eco/10 border border-eco/20 rounded-2xl p-6 flex gap-4 items-start">
                  <Leaf className="w-6 h-6 text-eco shrink-0 mt-1" />
                  <div>
                    <h4 className="text-eco font-semibold mb-2 uppercase tracking-wider text-sm">{lang.ecoFact}</h4>
                    <p className="text-zinc-300 leading-relaxed">{analysis.disposal.ecoFact}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={resetApp}
                className="px-8 py-4 rounded-full bg-eco text-dark font-bold text-lg hover:bg-[#00C853] transition-colors cursor-pointer"
              >
                {lang.startOver}
              </button>
            </motion.div>
          )}

          {/* SAVED PROJECTS SCREEN */}
          {appState === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-5xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold">{lang.savedProjects}</h2>
                <button
                  onClick={() => setAppState('upload')}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                  {lang.backButton}
                </button>
              </div>

              {savedProjects.length === 0 ? (
                <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-zinc-800/50">
                  <Bookmark className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 text-lg">{lang.noSavedProjects}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedProjects.map(project => {
                    const idea = project.analysis.ideas.find(i => i.id === project.selectedIdeaId);
                    if (!idea) return null;
                    return (
                      <div
                        key={project.id}
                        onClick={() => openSavedProject(project)}
                        className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-eco/50 transition-all cursor-pointer group flex flex-col"
                      >
                        <div className="aspect-video bg-zinc-800 relative shrink-0">
                          {project.generatedImage ? (
                            <img src={project.generatedImage} alt={idea.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                          )}
                          <button
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-500 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
                            title={lang.deleteProject}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="font-bold text-lg mb-1 line-clamp-1">{idea.title}</h3>
                          <p className="text-zinc-400 text-sm line-clamp-2 mb-4 flex-1">{idea.shortDescription}</p>
                          <div className="flex items-center justify-between text-xs text-zinc-500 mt-auto">
                            <span className="truncate max-w-[60%]">{project.analysis.itemName}</span>
                            <span>{new Date(project.dateSaved).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
