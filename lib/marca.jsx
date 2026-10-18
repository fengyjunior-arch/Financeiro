// The app mark: an orange rounded square with a darker inner corner, as in the header.
export function Marca({ size }) {
  const r = size * 0.22;
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0a09' }}>
      <div style={{ width: size * 0.62, height: size * 0.62, borderRadius: r, background: '#ff7a1a', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <div style={{ width: size * 0.3, height: size * 0.3, borderRadius: `${r * 0.6}px 0 ${r}px 0`, background: '#e85d04' }} />
      </div>
    </div>
  );
}
