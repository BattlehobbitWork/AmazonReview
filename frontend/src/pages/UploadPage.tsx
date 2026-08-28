import { useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Sparkles, Loader2, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { apiClient } from '@/lib/api';
import type { LLMSettings } from '@/lib/api';
import { toast } from 'sonner';

interface OutputReview {
  asin: string;
  product_name: string;
  star_rating: number;
  review_title: string;
  review_text: string;
}

interface SampleReview {
  star_rating: number;
  review_text: string;
}

interface ProductItem {
  asin: string;
  product_name: string;
  price?: number;
  purchase_date?: string;
}

interface UploadZoneProps {
  title: string;
  description: string;
  requiredColumns: string[];
  accept: string;
  onParsed: (data: Record<string, unknown>[]) => void;
  status: 'idle' | 'success' | 'error';
  rowCount: number;
  errorMessage: string;
}

function UploadZone({ title, description, requiredColumns, accept, onParsed, status, rowCount, errorMessage }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        onParsed(results.data as Record<string, unknown>[]);
      },
      error: () => {
        onParsed([]);
      },
    });
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Card className={`transition-colors ${isDragging ? 'border-primary bg-primary/5' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
          {status === 'idle' && <FileText className="h-5 w-5 text-muted-foreground" />}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag & drop a CSV file here, or click to browse
          </p>
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
            id={`upload-${title.replace(/\s/g, '-')}`}
          />
          <label htmlFor={`upload-${title.replace(/\s/g, '-')}`} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer">
            Choose File
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Required columns:</span>
          {requiredColumns.map((col) => (
            <Badge key={col} variant="secondary" className="text-xs">{col}</Badge>
          ))}
        </div>

        {status === 'success' && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            {rowCount} rows loaded successfully
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-destructive mt-2">{errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [sampleReviews, setSampleReviews] = useLocalStorage<SampleReview[]>('sampleReviews', []);
  const [productList, setProductList] = useLocalStorage<ProductItem[]>('productList', []);
  const [samplesStatus, setSamplesStatus] = useState<'idle' | 'success' | 'error'>(
    sampleReviews.length > 0 ? 'success' : 'idle'
  );
  const [productsStatus, setProductsStatus] = useState<'idle' | 'success' | 'error'>(
    productList.length > 0 ? 'success' : 'idle'
  );
  const [samplesError, setSamplesError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [outputReviews, setOutputReviews] = useLocalStorage<OutputReview[]>('outputReviews', []);
  const [llmSettings] = useLocalStorage<LLMSettings>('llmSettings', {});
  const [autoGenEnabled, setAutoGenEnabled] = useLocalStorage<boolean>('autoGenOnUpload', false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenProgress, setAutoGenProgress] = useState({ current: 0, total: 0, currentName: '' });
  const cancelRef = useRef(false);

  const handleSamplesParsed = useCallback((data: Record<string, unknown>[]) => {
    if (data.length === 0) {
      setSamplesStatus('error');
      setSamplesError('Failed to parse CSV file');
      return;
    }
    const first = data[0];
    if (!('star_rating' in first) || !('review_text' in first)) {
      setSamplesStatus('error');
      setSamplesError('Missing required columns: star_rating, review_text');
      return;
    }
    const parsed: SampleReview[] = data
      .filter((row) => row.star_rating && row.review_text)
      .map((row) => ({
        star_rating: Number(row.star_rating),
        review_text: String(row.review_text),
      }));
    setSampleReviews(parsed);
    setSamplesStatus('success');
    setSamplesError('');
  }, [setSampleReviews]);

  const handleProductsParsed = useCallback((data: Record<string, unknown>[]) => {
    if (data.length === 0) {
      setProductsStatus('error');
      setProductsError('Failed to parse CSV file');
      return;
    }
    const first = data[0];
    const keys = Object.keys(first);
    const hasAsin = keys.some((k) => k.toLowerCase() === 'asin');
    const hasName = keys.some((k) => k.toLowerCase() === 'product name' || k.toLowerCase() === 'product_name');
    if (!hasAsin || !hasName) {
      setProductsStatus('error');
      setProductsError('Missing required columns: ASIN, Product Name');
      return;
    }
    const asinKey = keys.find((k) => k.toLowerCase() === 'asin')!;
    const nameKey = keys.find((k) => k.toLowerCase() === 'product name' || k.toLowerCase() === 'product_name')!;
    const priceKey = keys.find((k) => k.toLowerCase() === 'price');
    const dateKey = keys.find((k) => {
      const lk = k.toLowerCase();
      return lk === 'purchase date' || lk === 'purchase_date' || lk === 'date' || lk === 'order date' || lk === 'order_date';
    });
    const parsed: ProductItem[] = data
      .filter((row) => row[asinKey] && row[nameKey])
      .map((row) => {
        const item: ProductItem = {
          asin: String(row[asinKey]),
          product_name: String(row[nameKey]),
        };
        if (priceKey) {
          const raw = String(row[priceKey] ?? '').replace(/[$,]/g, '').trim();
          const pv = raw === '' ? 0 : parseFloat(raw);
          if (!isNaN(pv) && pv >= 0) item.price = pv;
        }
        if (dateKey && row[dateKey]) {
          item.purchase_date = String(row[dateKey]).trim();
        }
        return item;
      });
    // Merge: keep existing products not in the new CSV, then add new CSV products
    setProductList((prev) => {
      const newAsins = new Set(parsed.map((p) => p.asin));
      const kept = prev.filter((p) => !newAsins.has(p.asin));
      return [...parsed, ...kept];
    });
    setProductsStatus('success');
    setProductsError('');

    // Auto-generate reviews for new products if enabled
    if (autoGenEnabled && sampleReviews.length > 0) {
      const existingReviewAsins = new Set(outputReviews.map((r) => r.asin));
      const newProducts = parsed.filter((p) => !existingReviewAsins.has(p.asin));
      if (newProducts.length > 0) {
        runAutoGenerate(newProducts);
      }
    }

    // Also register products with the backend price tracker (merge, no duplicates)
    apiClient.trackProducts(parsed).then((res) => {
      const { added, skipped, initial_prices } = res.data;
      let msg = '';
      if (added > 0) msg += `${added} new products added`;
      if (skipped > 0) msg += `${msg ? ', ' : ''}${skipped} already tracked`;
      if (initial_prices > 0) msg += `${msg ? ', ' : ''}${initial_prices} starting prices recorded`;
      if (added > 0 || initial_prices > 0) {
        toast.success(`Price Tracker: ${msg}`);
      } else if (skipped > 0) {
        toast.info(`Price Tracker: all ${skipped} products already tracked`);
      }
    }).catch(() => {
      // Silently fail — price tracking is supplementary
    });
  }, [setProductList]);

  const runAutoGenerate = useCallback(async (products: ProductItem[]) => {
    cancelRef.current = false;
    setIsAutoGenerating(true);
    setAutoGenProgress({ current: 0, total: products.length, currentName: '' });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i++) {
      if (cancelRef.current) break;
      const product = products[i];
      setAutoGenProgress({ current: i + 1, total: products.length, currentName: product.product_name });

      try {
        const res = await apiClient.autoGenerateReview({
          asin: product.asin,
          product_name: product.product_name,
          sample_reviews: sampleReviews,
          llm_settings: llmSettings,
        });
        setOutputReviews((prev) => {
          const filtered = prev.filter((r) => r.asin !== product.asin);
          return [...filtered, {
            asin: product.asin,
            product_name: product.product_name,
            star_rating: res.data.star_rating,
            review_title: res.data.review_title,
            review_text: res.data.review_text,
          }];
        });
        success++;
      } catch (err) {
        console.error(`Auto-gen failed for ${product.asin}:`, err);
        failed++;
      }
    }

    setIsAutoGenerating(false);
    if (cancelRef.current) {
      toast.info(`Auto-generation cancelled. Generated ${success} review${success !== 1 ? 's' : ''}.`);
    } else {
      toast.success(`Auto-generated ${success} review${success !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`);
    }
  }, [sampleReviews, llmSettings, setOutputReviews]);

  const canProceed = samplesStatus === 'success' && productsStatus === 'success';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Get Started</h1>
        <p className="text-muted-foreground mt-1">
          Upload your sample reviews and product list to begin generating reviews.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <UploadZone
          title="Sample Reviews"
          description="Your past reviews used as style examples for the LLM"
          requiredColumns={['star_rating', 'review_text']}
          accept=".csv"
          onParsed={handleSamplesParsed}
          status={samplesStatus}
          rowCount={sampleReviews.length}
          errorMessage={samplesError}
        />
        <UploadZone
          title="Product List"
          description="Amazon products to review (from Vine queue)"
          requiredColumns={['ASIN', 'Product Name']}
          accept=".csv"
          onParsed={handleProductsParsed}
          status={productsStatus}
          rowCount={productList.length}
          errorMessage={productsError}
        />
      </div>

      {/* Auto-Generate Toggle */}
      <Card className="border-dashed">
        <CardContent className="py-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Switch
                  checked={autoGenEnabled}
                  onCheckedChange={(checked) => setAutoGenEnabled(!!checked)}
                  id="auto-gen-toggle"
                />
                <Label htmlFor="auto-gen-toggle" className="flex items-center gap-2 cursor-pointer">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">Auto-generate reviews on upload</span>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-11">
                When enabled, new products will automatically get a review generated after upload using your LLM settings and sample reviews.
              </p>
            </div>
          </div>
          {isAutoGenerating && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                  {autoGenProgress.current} / {autoGenProgress.total} — {autoGenProgress.currentName.slice(0, 50)}{autoGenProgress.currentName.length > 50 ? '…' : ''}
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => { cancelRef.current = true; }}>
                  <StopCircle className="h-3 w-3" />
                  Stop
                </Button>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${(autoGenProgress.current / autoGenProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canProceed && (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => navigate('/review')} className="gap-2">
            Continue to Reviews
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
