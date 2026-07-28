import React from 'react';
import { UserSettings } from '../types';
import { SubscriptionManager } from './SubscriptionManager';

interface MySubscriptionsProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onOpenCheckout?: (plan?: 'monthly' | 'annual') => void;
}

export function MySubscriptions(props: MySubscriptionsProps) {
  return <SubscriptionManager {...props} />;
}

export default MySubscriptions;
