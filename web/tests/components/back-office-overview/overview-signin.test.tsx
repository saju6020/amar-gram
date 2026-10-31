import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetReportsMockData, setMockReportRoles } from '@/mocks/handlers/reports';
import { catalogueFor } from '@/mocks/handlers/reports/fixtures';
import StaffSignInPage from '@/app/(auth)/staff/sign-in/page';
import StaffForgotPasswordPage from '@/app/(auth)/staff/forgot-password/page';
import ReportsLayout from '@/app/(staff)/staff/reports/layout';
import { ReportViewer } from '@/components/reports/ReportViewer';
import { renderWithClient } from '../reports/helpers';

const nav = vi.hoisted(() => ({
  search: '',
  pathname: '/staff/customers',
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.search = '';
  nav.pathname = '/staff/customers';
  nav.push.mockReset();
  nav.replace.mockReset();
  resetReportsMockData();
});

describe('StaffAuthFrame — U11', () => {
  it('sign-in: h1 "Staff sign in", the helper line and the form; no data-theme anywhere', () => {
    const { container } = renderWithClient(<StaffSignInPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Staff sign in' })).toBeInTheDocument();
    expect(
      screen.getByText('Use your staff mobile number or email. Staff and customer accounts are separate.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Back office')).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number or email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(container.querySelector('[data-theme]')).toBeNull();
    expect(screen.getByTestId('staff-auth-frame')).toHaveClass('bg-leaf-ink');
  });

  it('forgot-password: the frame with the set-or-reset h1 and no helper line', () => {
    const { container } = renderWithClient(<StaffForgotPasswordPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Set or reset password' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Staff and customer accounts are separate/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-theme]')).toBeNull();
  });
});

describe('Reports layout and viewer — U15', () => {
  function useCatalogue(roles: string[]) {
    const entries = catalogueFor(roles);
    setMockReportRoles(roles);
    server.use(http.get('*/api/staff/reports', () => HttpResponse.json(entries)));
    return entries;
  }

  it('the report list is a nav named "Report list" and marks the current report', async () => {
    const entries = useCatalogue(['Administrator']);
    const current = entries[0]!;
    nav.pathname = `/staff/reports/${current.key}`;
    renderWithClient(
      <ReportsLayout>
        <p>viewer</p>
      </ReportsLayout>,
    );
    const list = await screen.findByRole('navigation', { name: 'Report list' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(entries.length);
    const marked = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent(current.title);
    expect(screen.getByText('viewer')).toBeInTheDocument();
  });

  it('on /staff/reports the layout draws the h1 and no report is current', async () => {
    useCatalogue(['Administrator']);
    nav.pathname = '/staff/reports';
    renderWithClient(
      <ReportsLayout>
        <p>choose</p>
      </ReportsLayout>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    const list = await screen.findByRole('navigation', { name: 'Report list' });
    expect(
      within(list)
        .getAllByRole('link')
        .some((link) => link.hasAttribute('aria-current')),
    ).toBe(false);
  });

  it('the chart has a table alternative and a polite readout', async () => {
    useCatalogue(['Administrator']);
    nav.pathname = '/staff/reports/new-vs-returning';
    renderWithClient(<ReportViewer reportKey="new-vs-returning" />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Show chart' }));
    const hidden = await screen.findByTestId('chart-data-table');
    const region = hidden.parentElement!;
    expect(region.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
