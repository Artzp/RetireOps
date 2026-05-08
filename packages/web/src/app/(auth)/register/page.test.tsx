/**
 * Register page — disclaimer-acceptance gate.
 *
 * Public-beta requirement: the user must explicitly accept the educational-only
 * disclaimer before they can create an account. The "Create account" submit
 * button (and the Google button) must remain disabled until the box is checked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockPush, mockToast } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import RegisterPage from './page';

describe('RegisterPage — disclaimer gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the disclaimer label with educational-only language', () => {
    render(<RegisterPage />);

    // The disclaimer must use the not-financial-advice phrasing — public-beta brief.
    expect(
      screen.getByText(/not financial, tax, or legal advice/i, { selector: 'label' })
    ).toBeInTheDocument();
  });

  it('disables the submit button until the disclaimer is accepted', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    expect(submitButton).toBeDisabled();

    const checkbox = screen.getByRole('checkbox', {
      name: /not financial, tax, or legal advice/i,
    });
    await user.click(checkbox);

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });

  it('disables the Google sign-up button until the disclaimer is accepted', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const googleButton = screen.getByRole('button', { name: /sign up with google/i });
    expect(googleButton).toBeDisabled();

    const checkbox = screen.getByRole('checkbox', {
      name: /not financial, tax, or legal advice/i,
    });
    await user.click(checkbox);

    await waitFor(() => {
      expect(googleButton).toBeEnabled();
    });
  });
});
