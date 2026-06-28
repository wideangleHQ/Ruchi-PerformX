import type { Metadata } from "next";
import { VMSLayout } from "@/features/vms/layout/VMSLayout";

export const metadata: Metadata = {
  title: "Visitor Management System",
  description: "PerformX Visitor Management System",
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VMSLayout>{children}</VMSLayout>;
}
