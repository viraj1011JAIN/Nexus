import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 px-4 py-8 sm:p-6 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      <div className="relative z-10 w-full max-w-[95vw] sm:max-w-md mx-auto">
        <div className="text-center mb-4 sm:mb-6 md:mb-8 animate-fadeInUp">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Join NEXUS
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 font-medium px-2">
            Create your account to get started
          </p>
        </div>
        
        <div className="glass-effect rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl border-2 border-white/20 animate-scaleIn">
          <SignUp 
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            afterSignUpUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none w-full",
                headerTitle: "text-lg sm:text-xl md:text-2xl font-bold text-slate-800",
                headerSubtitle: "text-xs sm:text-sm text-slate-600",
                socialButtonsBlockButton: "glass-effect border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-sm min-h-[44px]",
                formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:scale-105 active:scale-95 min-h-[44px]",
                formFieldInput: "border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 text-base min-h-[44px]",
                formFieldLabel: "text-xs sm:text-sm",
                footerActionLink: "text-indigo-600 hover:text-purple-600 text-sm",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
