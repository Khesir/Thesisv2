"use client"

/**
 * User Provider - Simple Name Storage for Validation Tracking
 *
 * This is NOT an authentication system. It simply stores a user's name
 * in localStorage to track who validated/merged crop data.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface UserContextType {
  username: string | null
  setUsername: (username: string) => void
  clearUsername: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const USERNAME_STORAGE_KEY = "thesis_validator_name"

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState<string | null>(null)

  // Load username from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_STORAGE_KEY)
    if (stored) {
      setUsernameState(stored)
    }
  }, [])

  const setUsername = (newUsername: string) => {
    setUsernameState(newUsername)
    localStorage.setItem(USERNAME_STORAGE_KEY, newUsername)
  }

  const clearUsername = () => {
    setUsernameState(null)
    localStorage.removeItem(USERNAME_STORAGE_KEY)
  }

  return (
    <UserContext.Provider value={{ username, setUsername, clearUsername }}>
      {children}
    </UserContext.Provider>
  )
}

/**
 * Hook to access the current user's name for validation tracking
 */
export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
