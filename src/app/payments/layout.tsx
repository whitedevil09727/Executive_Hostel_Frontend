import { ReactNode } from 'react';
import DashboardLayout from '../dashboard/layout';

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
