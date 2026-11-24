export default function AuthLayout({ children }: LayoutProps<'/[lang]'>) {
  return <main className="flex flex-1 items-center justify-center p-4 sm:p-6">{children}</main>
}
