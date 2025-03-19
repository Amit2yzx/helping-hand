import { Redirect } from 'expo-router';
import React, { useEffect } from 'react';

export default function TabsIndex() {
  useEffect(() => {
    console.log("Tabs index mounted - redirecting to home tab");
  }, []);
  
  // Redirect to the home tab
  return <Redirect href="/(tabs)/home" />;
} 