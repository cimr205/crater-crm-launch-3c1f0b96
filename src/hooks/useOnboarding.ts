import { useState } from 'react';
import { markOnboardingComplete, isOnboardingComplete } from '@/lib/onboarding';

export type OnboardingStep = 'basics' | 'team' | 'integrations' | 'finish';

const STEPS: OnboardingStep[] = ['basics', 'team', 'integrations', 'finish'];

export function useOnboarding() {
  const [step, setStep] = useState<OnboardingStep>('basics');
  const completed = isOnboardingComplete();

  const currentIndex = STEPS.indexOf(step);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STEPS.length - 1;

  const next = () => {
    if (!isLast) setStep(STEPS[currentIndex + 1]);
  };

  const back = () => {
    if (!isFirst) setStep(STEPS[currentIndex - 1]);
  };

  const finish = () => {
    markOnboardingComplete();
  };

  return { step, setStep, next, back, finish, isFirst, isLast, completed };
}
