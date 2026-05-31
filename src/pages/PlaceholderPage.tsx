export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-slate-400">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-2xl font-semibold text-slate-700 mb-2">{title}</h2>
      <p className="text-slate-500">Раздел находится в разработке (Задача 001)</p>
    </div>
  );
}
