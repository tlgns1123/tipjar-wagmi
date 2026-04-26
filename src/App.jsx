import { useState, useEffect } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { TIPJAR_ABI, TIPJAR_ADDRESS } from './abi'

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (wei) => {
  if (wei === undefined || wei === null) return '0'
  return parseFloat(formatEther(wei)).toFixed(6).replace(/\.?0+$/, '') || '0'
}

const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

const timeAgo = (ts) => {
  const diff = Math.floor(Date.now() / 1000) - Number(ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const MEDAL = ['🥇', '🥈', '🥉']

// ── sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={s.statCard}>
      <p style={s.statLabel}>{label}</p>
      <p style={s.statValue}>{value}</p>
      {sub && <p style={s.statSub}>{sub}</p>}
    </div>
  )
}

function Toast({ msg, ok }) {
  return (
    <div style={{ ...s.toast, background: ok ? '#064e3b' : '#450a0a', borderColor: ok ? '#10b981' : '#ef4444' }}>
      <span style={{ marginRight: 8 }}>{ok ? '✓' : '✕'}</span>{msg}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [tipAmount, setTipAmount] = useState('')
  const [tipMessage, setTipMessage] = useState('')
  const [toast, setToast] = useState(null)
  const [histPage, setHistPage] = useState(0)
  const PAGE = 5

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── contract reads ────────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = useReadContract({
    address: TIPJAR_ADDRESS,
    abi: TIPJAR_ABI,
    functionName: 'getStats',
    watch: true,
  })

  const { data: owner } = useReadContract({
    address: TIPJAR_ADDRESS,
    abi: TIPJAR_ABI,
    functionName: 'owner',
  })

  const { data: history, refetch: refetchHistory } = useReadContract({
    address: TIPJAR_ADDRESS,
    abi: TIPJAR_ABI,
    functionName: 'getTipHistory',
  })

  const { data: topData, refetch: refetchTop } = useReadContract({
    address: TIPJAR_ADDRESS,
    abi: TIPJAR_ABI,
    functionName: 'getTopTippers',
    args: [BigInt(5)],
  })

  const { data: myTotalAmount } = useReadContract({
    address: TIPJAR_ADDRESS,
    abi: TIPJAR_ABI,
    functionName: 'tipperTotalAmount',
    args: address ? [address] : undefined,
    enabled: !!address,
  })

  const { data: myTipCount } = useReadContract({
    address: TIPJAR_ADDRESS,
    abi: TIPJAR_ABI,
    functionName: 'tipperCount',
    args: address ? [address] : undefined,
    enabled: !!address,
  })

  // ── write: tip ────────────────────────────────────────────────────────────
  const { writeContract: doTip, data: tipHash, isPending: tipSubmitting, error: tipError } = useWriteContract()
  const { isLoading: tipConfirming, isSuccess: tipDone } = useWaitForTransactionReceipt({ hash: tipHash })

  useEffect(() => {
    if (tipDone) {
      showToast('Tip sent successfully!')
      setTipAmount('')
      setTipMessage('')
      refetchStats()
      refetchHistory()
      refetchTop()
    }
  }, [tipDone])

  useEffect(() => {
    if (tipError) showToast(tipError.shortMessage || 'Transaction failed', false)
  }, [tipError])

  // ── write: withdraw ───────────────────────────────────────────────────────
  const { writeContract: doWithdraw, data: wdHash, isPending: wdSubmitting, error: wdError } = useWriteContract()
  const { isLoading: wdConfirming, isSuccess: wdDone } = useWaitForTransactionReceipt({ hash: wdHash })

  useEffect(() => {
    if (wdDone) {
      showToast('Tips withdrawn!')
      refetchStats()
    }
  }, [wdDone])

  useEffect(() => {
    if (wdError) showToast(wdError.shortMessage || 'Withdraw failed', false)
  }, [wdError])

  // ── derived ───────────────────────────────────────────────────────────────
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()
  const [balance, count, total] = stats || [0n, 0n, 0n]

  const reversed = history ? [...history].reverse() : []
  const totalPages = Math.ceil(reversed.length / PAGE)
  const pageSlice = reversed.slice(histPage * PAGE, histPage * PAGE + PAGE)

  const handleTip = () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) return
    doTip({
      address: TIPJAR_ADDRESS,
      abi: TIPJAR_ABI,
      functionName: 'tip',
      args: [tipMessage],
      value: parseEther(tipAmount),
    })
  }

  const handleWithdraw = () => {
    doWithdraw({
      address: TIPJAR_ADDRESS,
      abi: TIPJAR_ABI,
      functionName: 'withdrawTips',
    })
  }

  const tipBusy = tipSubmitting || tipConfirming
  const wdBusy = wdSubmitting || wdConfirming

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* ── header ── */}
      <header style={s.header}>
        <div style={s.logo}>
          <span style={s.logoIcon}>💰</span>
          <span style={s.logoText}>TipJar</span>
          <span style={s.badge}>Sepolia</span>
        </div>

        {isConnected ? (
          <div style={s.walletRow}>
            <div style={s.addrBox}>
              <span style={s.dot} />
              <span style={s.addrText}>{shortAddr(address)}</span>
            </div>
            <button style={s.btnOutline} onClick={() => disconnect()}>Disconnect</button>
          </div>
        ) : (
          <div style={s.walletRow}>
            {connectors.map((c) => (
              <button key={c.id} style={s.btnPrimary} onClick={() => connect({ connector: c })}>
                Connect {c.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main style={s.main}>

        {/* ── stats ── */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Contract Stats</h2>
          <div style={s.statsGrid}>
            <StatCard label="Current Balance" value={`${fmt(balance)} ETH`} />
            <StatCard label="Total Tips Sent" value={count?.toString() ?? '0'} />
            <StatCard label="All-Time Volume" value={`${fmt(total)} ETH`} />
          </div>
        </section>

        <div style={s.columns}>

          {/* ── left col ── */}
          <div style={s.leftCol}>

            {/* ── send tip ── */}
            <section style={s.card}>
              <h2 style={s.cardTitle}>Send a Tip</h2>
              {!isConnected && (
                <p style={s.notice}>Connect your wallet to send a tip.</p>
              )}
              <label style={s.label}>Amount (ETH)</label>
              <input
                style={s.input}
                type="number"
                min="0"
                step="0.001"
                placeholder="0.01"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                disabled={!isConnected}
              />
              <label style={s.label}>Message (optional)</label>
              <textarea
                style={{ ...s.input, height: 72, resize: 'none' }}
                placeholder="Keep up the great work!"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                disabled={!isConnected}
              />
              <button
                style={{
                  ...s.btnPrimary,
                  width: '100%',
                  marginTop: 8,
                  opacity: (!isConnected || !tipAmount || tipBusy) ? 0.5 : 1,
                }}
                disabled={!isConnected || !tipAmount || tipBusy}
                onClick={handleTip}
              >
                {tipBusy ? (tipSubmitting ? 'Confirm in wallet…' : 'Confirming…') : '✦ Send Tip'}
              </button>
            </section>

            {/* ── my stats ── */}
            {isConnected && (
              <section style={s.card}>
                <h2 style={s.cardTitle}>My Stats</h2>
                <div style={s.myRow}>
                  <div style={s.myItem}>
                    <span style={s.myLabel}>My Tips Sent</span>
                    <span style={s.myVal}>{myTipCount?.toString() ?? '0'}</span>
                  </div>
                  <div style={s.myItem}>
                    <span style={s.myLabel}>My Total Amount</span>
                    <span style={s.myVal}>{fmt(myTotalAmount)} ETH</span>
                  </div>
                </div>
              </section>
            )}

            {/* ── withdraw (owner only) ── */}
            {isOwner && (
              <section style={{ ...s.card, borderColor: '#4c1d95' }}>
                <h2 style={s.cardTitle}>
                  <span style={{ color: '#a78bfa' }}>⚡ Owner Panel</span>
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
                  Contract balance: <strong style={{ color: 'var(--text)' }}>{fmt(balance)} ETH</strong>
                </p>
                <button
                  style={{
                    ...s.btnAccent,
                    width: '100%',
                    opacity: (wdBusy || balance === 0n) ? 0.5 : 1,
                  }}
                  disabled={wdBusy || balance === 0n}
                  onClick={handleWithdraw}
                >
                  {wdBusy ? (wdSubmitting ? 'Confirm in wallet…' : 'Withdrawing…') : 'Withdraw All Tips'}
                </button>
              </section>
            )}
          </div>

          {/* ── right col ── */}
          <div style={s.rightCol}>

            {/* ── top tippers ── */}
            <section style={s.card}>
              <h2 style={s.cardTitle}>Top Tippers</h2>
              {topData && topData[0].length > 0 ? (
                <div>
                  {topData[0].map((addr, i) => (
                    <div key={addr} style={s.topRow}>
                      <span style={s.topMedal}>{MEDAL[i] ?? `#${i + 1}`}</span>
                      <span style={s.topAddr}>{shortAddr(addr)}</span>
                      <span style={s.topAmt}>{fmt(topData[1][i])} ETH</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={s.empty}>No tips yet. Be the first!</p>
              )}
            </section>

            {/* ── tip history ── */}
            <section style={s.card}>
              <div style={s.histHeader}>
                <h2 style={s.cardTitle}>Tip History</h2>
                <span style={s.histCount}>{history?.length ?? 0} tips</span>
              </div>

              {pageSlice.length === 0 ? (
                <p style={s.empty}>No tips recorded yet.</p>
              ) : (
                pageSlice.map((tip, i) => (
                  <div key={i} style={s.tipRow}>
                    <div style={s.tipLeft}>
                      <span style={s.tipAddr}>{shortAddr(tip.tipper)}</span>
                      {tip.message && <span style={s.tipMsg}>"{tip.message}"</span>}
                    </div>
                    <div style={s.tipRight}>
                      <span style={s.tipAmt}>{fmt(tip.amount)} ETH</span>
                      <span style={s.tipTime}>{timeAgo(tip.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}

              {totalPages > 1 && (
                <div style={s.pagination}>
                  <button style={s.pageBtn} disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)}>←</button>
                  <span style={s.pageInfo}>{histPage + 1} / {totalPages}</span>
                  <button style={s.pageBtn} disabled={histPage >= totalPages - 1} onClick={() => setHistPage(p => p + 1)}>→</button>
                </div>
              )}
            </section>

          </div>
        </div>
      </main>

      <footer style={s.footer}>
        <span>TipJar · Sepolia Testnet · </span>
        <a href={`https://sepolia.etherscan.io/address/${TIPJAR_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={s.link}>
          {shortAddr(TIPJAR_ADDRESS)}
        </a>
      </footer>
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },

  toast: {
    position: 'fixed', top: 20, right: 20, zIndex: 999,
    padding: '12px 20px', borderRadius: 10, border: '1px solid',
    fontSize: 14, fontWeight: 500, color: '#fff',
    backdropFilter: 'blur(10px)',
  },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 32px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { fontSize: 28 },
  logoText: { fontSize: 22, fontWeight: 700, color: '#fff' },
  badge: {
    fontSize: 11, fontWeight: 600, padding: '2px 8px',
    background: '#1e1b4b', color: '#818cf8',
    borderRadius: 20, border: '1px solid #3730a3',
  },
  walletRow: { display: 'flex', alignItems: 'center', gap: 10 },
  addrBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 14px', borderRadius: 8,
    background: '#0f172a', border: '1px solid var(--border2)',
    fontSize: 13,
  },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#10b981' },
  addrText: { color: 'var(--sub)', fontWeight: 500 },

  main: { flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '32px 24px' },

  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  statCard: {
    padding: '20px 24px', borderRadius: 'var(--radius)',
    background: 'var(--surface)', border: '1px solid var(--border)',
    backgroundImage: 'linear-gradient(135deg, rgba(124,58,237,0.05) 0%, transparent 60%)',
  },
  statLabel: { fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 },
  statSub: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },

  columns: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 16 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 16 },

  card: {
    padding: '24px', borderRadius: 'var(--radius)',
    background: 'var(--surface)', border: '1px solid var(--border)',
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 16 },

  notice: { fontSize: 13, color: 'var(--muted)', marginBottom: 12, padding: '10px 14px', background: '#0f172a', borderRadius: 8 },

  label: { display: 'block', fontSize: 13, color: 'var(--sub)', fontWeight: 500, marginBottom: 6, marginTop: 12 },
  input: {
    width: '100%', padding: '10px 14px',
    background: '#0f0f1a', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text)', fontSize: 14,
    outline: 'none', transition: 'border-color 0.2s',
  },

  btnPrimary: {
    padding: '10px 20px', borderRadius: 8,
    background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#fff', fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  btnOutline: {
    padding: '8px 16px', borderRadius: 8,
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--sub)', fontWeight: 500, fontSize: 13,
    cursor: 'pointer',
  },
  btnAccent: {
    padding: '11px 20px', borderRadius: 8,
    background: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
    color: '#fff', fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer',
  },

  myRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  myItem: {
    padding: '14px 16px', borderRadius: 10,
    background: '#0f0f1a', border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  myLabel: { fontSize: 12, color: 'var(--muted)' },
  myVal: { fontSize: 20, fontWeight: 700, color: '#fff' },

  topRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', borderRadius: 8,
    background: '#0f0f1a', marginBottom: 8,
    border: '1px solid var(--border)',
  },
  topMedal: { fontSize: 18, width: 24 },
  topAddr: { flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--sub)', fontFamily: 'monospace' },
  topAmt: { fontSize: 14, fontWeight: 600, color: '#a78bfa' },

  histHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  histCount: { fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#1e1e32', color: 'var(--muted)' },

  tipRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '12px 0', borderBottom: '1px solid var(--border)',
    gap: 12,
  },
  tipLeft: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'hidden' },
  tipAddr: { fontSize: 13, fontWeight: 500, color: 'var(--sub)', fontFamily: 'monospace' },
  tipMsg: { fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 },
  tipRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  tipAmt: { fontSize: 14, fontWeight: 600, color: '#34d399' },
  tipTime: { fontSize: 11, color: 'var(--muted)' },

  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  pageBtn: {
    width: 32, height: 32, borderRadius: 6,
    background: '#0f0f1a', border: '1px solid var(--border2)',
    color: 'var(--text)', cursor: 'pointer', fontSize: 16,
  },
  pageInfo: { fontSize: 13, color: 'var(--muted)' },

  empty: { fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' },

  footer: {
    padding: '16px 32px',
    borderTop: '1px solid var(--border)',
    fontSize: 12, color: 'var(--muted)',
    textAlign: 'center',
  },
  link: { color: '#818cf8', textDecoration: 'none' },
}
