'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useCodeFlowStore, SupportedLanguage } from '../../store/useCodeFlowStore';
import { 
  Award, ArrowRight
} from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  lang: SupportedLanguage;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  template: string;
}

export default function PracticePage() {
  const router = useRouter();
  const { setCode, setLanguage } = useCodeFlowStore();

  const challenges: Challenge[] = [
    {
      id: 'py-factorial',
      title: 'Factorial Recursion',
      lang: 'python',
      difficulty: 'Beginner',
      description: 'Implement a function that computes the factorial of n recursively (n!). Observe how stack frames accumulate in stack memory.',
      template: `def factorial(n):
    # Fix the code to calculate factorial recursively
    if n <= 1:
        return 1
    return n * factorial(n - 1)

res = factorial(4)
print("Factorial of 4 is:", res)
`
    },
    {
      id: 'js-reverse',
      title: 'In-Place Array Reversing',
      lang: 'javascript',
      difficulty: 'Intermediate',
      description: 'Reverse an array in-place. Step through the loop to see variable indices swap their values on the Heap memory grid.',
      template: `function reverseArray(arr) {
  let left = 0;
  let right = arr.length - 1;
  
  while (left < right) {
    let temp = arr[left];
    arr[left] = arr[right];
    arr[right] = temp;
    left++;
    right--;
  }
  
  console.log("Reversed output array:", arr);
}

reverseArray([10, 20, 30, 40]);
`
    },
    {
      id: 'c-swap',
      title: 'Pointer Variable Swapping',
      lang: 'c',
      difficulty: 'Advanced',
      description: 'Implement swap() using C pointers. Animate the arrows crossing on the stack to dereference and swap stack frame values.',
      template: `void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
  }
  
  int main() {
    int x = 55;
    int y = 99;
    
    printf("Before swap: x=%d, y=%d\\n", x, y);
    swap(&x, &y);
    printf("After swap: x=%d, y=%d\\n", x, y);
    
    return 0;
  }
`
    }
  ];

  const handleStartChallenge = (challenge: Challenge) => {
    // Set store code and language
    setLanguage(challenge.lang);
    setCode(challenge.template);
    
    // Redirect to IDE
    router.push('/learn');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0F172A] text-slate-100 overflow-y-auto">
      <Navbar />

      <main className="max-w-5xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        
        {/* Intro */}
        <div className="mb-10 text-center md:text-left flex flex-col md:flex-row items-center justify-between border-b border-slate-900 pb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Interactive Concept Challenges
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-xl">
              Preload structured algorithm templates into the visual IDE. Solve problems and analyze compiler memory trace models step-by-step.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-2 bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-xl text-blue-400 text-xs font-semibold">
            <Award size={16} />
            <span>3 Practice Challenges Available</span>
          </div>
        </div>

        {/* Challenge list */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {challenges.map((c) => {
            const diffColor = 
              c.difficulty === 'Beginner' ? 'text-green-400 border-green-500/20 bg-green-500/5' :
              c.difficulty === 'Intermediate' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
              'text-red-400 border-red-500/20 bg-red-500/5';

            return (
              <div 
                key={c.id} 
                className="bg-slate-900/50 border border-slate-850 hover:border-slate-800 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md group"
              >
                <div className="space-y-3">
                  {/* Top tags */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500">
                      {c.lang.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold tracking-wider ${diffColor}`}>
                      {c.difficulty}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                    {c.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed min-h-[60px]">
                    {c.description}
                  </p>
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleStartChallenge(c)}
                  className="mt-6 w-full inline-flex items-center justify-center space-x-2 bg-slate-800 hover:bg-blue-600 hover:text-white active:scale-95 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-all duration-200 cursor-pointer border border-slate-700/60 hover:border-transparent shadow-sm"
                >
                  <span>Solve Challenge</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
