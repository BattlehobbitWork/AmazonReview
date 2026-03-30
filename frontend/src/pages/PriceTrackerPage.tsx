import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingDown, TrendingUp, RefreshCw, ExternalLink,
  Loader2, BarChart3, ArrowUpDown, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import type { PriceSummaryEntry, PriceHistoryEntry } from '@/lib/api';
import { toast } from 'sonner';

type SortField = 'product_name' | 'current_price' | 'lowest_price_365d' | 'highest_price_365d' | 'check_count';
type SortDir = 'asc' | 'desc';

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return `$${price.toFixed(2)}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function MiniSparkline({ data }: { data: PriceHistoryEntry[] }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground">Not enough data</span>;

  const prices = data.filter(d => d.price != null).map(d => d.price as number);
  if (prices.length < 2) return <span className="text-xs text-muted-foreground">Not enough data</span>;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const padding = 2;

  const points = prices.map((p, i) => {
    const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
    const y = h - padding - ((p - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
    </svg>
  );
}

export default function PriceTrackerPage() {
  const [summary, setSummary] = useState<PriceSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Record<string, PriceHistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.getPriceSummary();
      setSummary(res.data);
    } catch {
      toast.error('Failed to load price data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await apiClient.triggerPriceCheck();
      toast.success('Price check started', { description: 'This may take a few minutes for all products.' });
      // Refresh after a delay
      setTimeout(() => fetchSummary(), 5000);
    } catch {
      toast.error('Failed to trigger price check');
    } finally {
      setChecking(false);
    }
  };

  const handleToggleHistory = async (asin: string) => {
    if (expandedAsin === asin) {
      setExpandedAsin(null);
      return;
    }
    setExpandedAsin(asin);
    if (!historyData[asin]) {
      setHistoryLoading(asin);
      try {
        const res = await apiClient.getPriceHistory(asin);
        setHistoryData(prev => ({ ...prev, [asin]: res.data }));
      } catch {
        toast.error('Failed to load price history');
      } finally {
        setHistoryLoading(null);
      }
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  // Filter and sort
  const filtered = summary.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.product_name.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    const av = a[sortField];
    const bv = b[sortField];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return mul * av.localeCompare(bv as string);
    return mul * ((av as number) - (bv as number));
  });

  // Stats
  const totalTracked = summary.length;
  const withPrices = summary.filter(p => p.current_price != null).length;
  const avgPrice = withPrices > 0
    ? summary.reduce((sum, p) => sum + (p.current_price || 0), 0) / withPrices
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Price Tracker</h1>
          <p className="text-muted-foreground mt-1">
            Tracking {totalTracked} products — prices checked every 12 hours
          </p>
        </div>
        <Button onClick={handleCheckNow} disabled={checking} className="gap-2">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Check Prices Now
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Products Tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTracked}</div>
            <p className="text-xs text-muted-foreground">{withPrices} with price data</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(avgPrice || null)}</div>
            <p className="text-xs text-muted-foreground">across tracked items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Price Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.reduce((s, p) => s + p.check_count, 0)}</div>
            <p className="text-xs text-muted-foreground">data points collected</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by product name or ASIN..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-md"
      />

      {/* Price Table */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {totalTracked === 0 ? 'No Products Tracked Yet' : 'No Results'}
            </h2>
            <p className="text-muted-foreground">
              {totalTracked === 0
                ? 'Upload a product list on the Upload page to start tracking prices automatically.'
                : 'No products match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium px-4 py-2.5">
                      <button className="flex items-center gap-1" onClick={() => handleSort('product_name')}>
                        Product <SortIcon field="product_name" />
                      </button>
                    </th>
                    <th className="text-left font-medium px-4 py-2.5 hidden sm:table-cell">ASIN</th>
                    <th className="text-right font-medium px-4 py-2.5">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => handleSort('current_price')}>
                        Current <SortIcon field="current_price" />
                      </button>
                    </th>
                    <th className="text-right font-medium px-4 py-2.5">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => handleSort('lowest_price_365d')}>
                        Low <SortIcon field="lowest_price_365d" />
                      </button>
                    </th>
                    <th className="text-right font-medium px-4 py-2.5 hidden md:table-cell">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => handleSort('highest_price_365d')}>
                        High <SortIcon field="highest_price_365d" />
                      </button>
                    </th>
                    <th className="text-center font-medium px-4 py-2.5 hidden lg:table-cell">Trend</th>
                    <th className="text-right font-medium px-4 py-2.5">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => handleSort('check_count')}>
                        Checks <SortIcon field="check_count" />
                      </button>
                    </th>
                    <th className="text-right font-medium px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const isExpanded = expandedAsin === p.asin;
                    const atLow = p.current_price != null && p.lowest_price_365d != null
                      && p.current_price <= p.lowest_price_365d;
                    return (
                      <>
                        <tr
                          key={p.asin}
                          className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/20' : ''}`}
                          onClick={() => handleToggleHistory(p.asin)}
                        >
                          <td className="px-4 py-2.5">
                            <span className="line-clamp-1 max-w-[200px] sm:max-w-[300px] font-medium">
                              {p.product_name}
                            </span>
                            {atLow && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-600 ml-2">
                                <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                                At Low
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <Badge variant="secondary" className="font-mono text-xs">{p.asin}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {formatPrice(p.current_price)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-600 dark:text-green-400">
                            {formatPrice(p.lowest_price_365d)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400 hidden md:table-cell">
                            {formatPrice(p.highest_price_365d)}
                          </td>
                          <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                            {historyData[p.asin] ? (
                              <MiniSparkline data={historyData[p.asin]} />
                            ) : (
                              <span className="text-xs text-muted-foreground">Click to load</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">
                            {p.check_count}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); window.open(`https://www.amazon.com/dp/${p.asin}`, '_blank'); }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${p.asin}-detail`}>
                            <td colSpan={8} className="px-4 py-3 bg-muted/10 border-b">
                              {historyLoading === p.asin ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
                                </div>
                              ) : historyData[p.asin] && historyData[p.asin].length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span><DollarSign className="h-3 w-3 inline" /> Added: {formatDate(p.added_at)}</span>
                                    <span>Last checked: {formatDate(p.last_checked)}</span>
                                    {p.lowest_price_date && (
                                      <span className="text-green-600 dark:text-green-400">
                                        <TrendingDown className="h-3 w-3 inline" /> Lowest on {formatDate(p.lowest_price_date)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {historyData[p.asin].slice(-20).map((h, i) => (
                                      <div key={i} className="text-xs px-2 py-1 rounded bg-background border">
                                        <span className="font-medium">{formatPrice(h.price)}</span>
                                        <span className="text-muted-foreground ml-1">{formatDate(h.scraped_at)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No price history yet. Prices will be checked automatically every 12 hours.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
