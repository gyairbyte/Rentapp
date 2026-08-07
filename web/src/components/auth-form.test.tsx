// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AuthForm } from './auth-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('AuthForm password visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('toggles the password input type and does not submit the form', () => {
    const action = vi.fn().mockResolvedValue({ success: true })
    render(<AuthForm mode="signin" action={action} />)

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    const toggleButton = screen.getByRole('button', { name: /Show password/i })

    expect(passwordInput.type).toBe('password')
    expect(toggleButton.getAttribute('type')).toBe('button')
    expect(toggleButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(toggleButton)

    expect(passwordInput.type).toBe('text')
    expect(toggleButton.getAttribute('aria-label')).toBe('Hide password')
    expect(toggleButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggleButton)

    expect(passwordInput.type).toBe('password')
    expect(toggleButton.getAttribute('aria-label')).toBe('Show password')
    expect(toggleButton.getAttribute('aria-pressed')).toBe('false')

    expect(action).not.toHaveBeenCalled()
  })

  it('has the correct accessible name in signup mode', () => {
    const action = vi.fn().mockResolvedValue({ success: true })
    render(<AuthForm mode="signup" action={action} />)

    const toggleButton = screen.getByRole('button', { name: /Show password/i })
    expect(toggleButton).toBeTruthy()
  })
})
