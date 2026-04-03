import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Search, X, CheckCircle2, Flag, Star, ListChecks, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';

interface ProductItem {
  asin: string;
  product_name: string;
}

interface OutputReview {
  asin: string;
  product_name: string;
  star_rating: number;
  review_title: string;
  review_text: string;
}

export default function ManageProductsPage() {
  const [productList, setProductList] = useLocalStorage<ProductItem[]>('productList', []);
  const [outputReviews, setOutputReviews] = useLocalStorage<OutputReview[]>('outputReviews', []);
  const [completedProducts, setCompletedProducts] = useLocalStorage<string[]>('completedProducts', []);
  const [flaggedProducts, setFlaggedProducts] = useLocalStorage<string[]>('flaggedProducts', []);
  const [allDrafts, setAllDrafts] = useLocalStorage<Record<string, unknown>>('productDrafts', {});
  const [, setCurrentIndex] = useLocalStorage<number>('currentProductIndex', 0);
  const navigate = useNavigate();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'reviewed' | 'flagged' | 'completed' | 'unreviewed'>('all');
  const [sortColumn, setSortColumn] = useState<'name' | 'asin' | 'status' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const reviewedAsins = useMemo(() => new Set(outputReviews.map((r) => r.asin)), [outputReviews]);

  const filteredProducts = useMemo(() => {
    let list = productList;

    // Apply filter
    if (filterMode === 'reviewed') list = list.filter((p) => reviewedAsins.has(p.asin));
    else if (filterMode === 'flagged') list = list.filter((p) => flaggedProducts.includes(p.asin));
    else if (filterMode === 'completed') list = list.filter((p) => completedProducts.includes(p.asin));
    else if (filterMode === 'unreviewed') list = list.filter((p) => !reviewedAsins.has(p.asin) && !completedProducts.includes(p.asin));

    // Apply search
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.product_name.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q)
      );
    }

    // Apply sort
    if (sortColumn) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'name') {
          cmp = a.product_name.localeCompare(b.product_name);
        } else if (sortColumn === 'asin') {
          cmp = a.asin.localeCompare(b.asin);
        } else if (sortColumn === 'status') {
          const statusScore = (asin: string) => {
            let s = 0;
            if (completedProducts.includes(asin)) s += 4;
            if (reviewedAsins.has(asin)) s += 2;
            if (flaggedProducts.includes(asin)) s += 1;
            return s;
          };
          cmp = statusScore(b.asin) - statusScore(a.asin);
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }

    return list;
  }, [productList, filterMode, searchQuery, reviewedAsins, flaggedProducts, completedProducts, sortColumn, sortDir]);

  const toggleSelect = (asin: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filteredAsins = filteredProducts.map((p) => p.asin);
    const allSelected = filteredAsins.every((a) => selected.has(a));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredAsins.forEach((a) => next.delete(a));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredAsins.forEach((a) => next.add(a));
        return next;
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Remove ${selected.size} product${selected.size > 1 ? 's' : ''} from the list? This cannot be undone.`)) return;

    setProductList((prev) => prev.filter((p) => !selected.has(p.asin)));
    setOutputReviews((prev) => prev.filter((r) => !selected.has(r.asin)));
    setCompletedProducts((prev) => prev.filter((a) => !selected.has(a)));
    setFlaggedProducts((prev) => prev.filter((a) => !selected.has(a)));
    setAllDrafts((prev) => {
      const copy = { ...(prev as Record<string, unknown>) };
      selected.forEach((asin) => delete copy[asin]);
      return copy;
    });
    setCurrentIndex(0);

    toast.success(`Removed ${selected.size} product${selected.size > 1 ? 's' : ''}`);
    setSelected(new Set());
  };

  const handleGoToProduct = (asin: string) => {
    const idx = productList.findIndex((p) => p.asin === asin);
    if (idx !== -1) {
      setCurrentIndex(idx);
      navigate('/review');
    }
  };

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selected.has(p.asin));

  const handleSort = (col: 'name' | 'asin' | 'status') => {
    if (sortColumn === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: 'name' | 'asin' | 'status' }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  if (productList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Products</h2>
        <p className="text-muted-foreground mb-4">Upload a product list first.</p>
        <Button onClick={() => navigate('/')}>Go to Upload</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manage Products</h1>
          <p className="text-muted-foreground mt-1">
            {productList.length} total products · {selected.size} selected
          </p>
        </div>
        {selected.size > 0 && (
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleDeleteSelected}
          >
            <Trash2 className="h-4 w-4" />
            Remove {selected.size} Selected
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product name or ASIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'unreviewed', 'reviewed', 'completed', 'flagged'] as const).map((mode) => (
            <Button
              key={mode}
              variant={filterMode === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode(mode)}
              className="capitalize"
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            {filterMode === 'all' ? 'All Products' : `${filterMode.charAt(0).toUpperCase() + filterMode.slice(1)} Products`}
            <Badge variant="secondary" className="ml-1">{filteredProducts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left font-medium px-4 py-2.5">
                    <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      Product <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-left font-medium px-4 py-2.5 hidden sm:table-cell">
                    <button onClick={() => handleSort('asin')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      ASIN <SortIcon col="asin" />
                    </button>
                  </th>
                  <th className="text-left font-medium px-4 py-2.5">
                    <button onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const isSelected = selected.has(product.asin);
                  const isReviewed = reviewedAsins.has(product.asin);
                  const isCompleted = completedProducts.includes(product.asin);
                  const isFlagged = flaggedProducts.includes(product.asin);
                  const review = outputReviews.find((r) => r.asin === product.asin);

                  return (
                    <tr
                      key={product.asin}
                      className={`border-b last:border-0 transition-colors ${
                        isSelected ? 'bg-destructive/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(product.asin)}
                          aria-label={`Select ${product.product_name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="line-clamp-2 max-w-[200px] sm:max-w-[350px]">
                          {product.product_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {product.asin}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isReviewed && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-600 gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              {review?.star_rating}
                            </Badge>
                          )}
                          {isCompleted && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-500 border-blue-500 gap-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Done
                            </Badge>
                          )}
                          {isFlagged && (
                            <Flag className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleGoToProduct(product.asin)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No products match your search or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
