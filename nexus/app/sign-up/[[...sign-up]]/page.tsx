import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-fadeInUp">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Join NEXUS
          </h1>
          <p className="text-slate-600 font-medium">
            Create your account to get started
          </p>
        </div>
        
        <div className="glass-effect rounded-2xl p-8 shadow-2xl border-2 border-white/20 animate-scaleIn">
          <SignUp 
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            afterSignUpUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none",
                headerTitle: "text-2xl font-bold text-slate-800",
                headerSubtitle: "text-slate-600",
                socialButtonsBlockButton: "glass-effect border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all",
                formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:scale-105 active:scale-95",
                formFieldInput: "border-slate-200 focus:border-indigo-400 focus:ring-indigo-400",
                footerActionLink: "text-indigo-600 hover:text-purple-600",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
