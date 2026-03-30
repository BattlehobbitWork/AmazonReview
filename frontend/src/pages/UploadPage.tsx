import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

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
        if (priceKey && row[priceKey]) {
          const pv = parseFloat(String(row[priceKey]).replace(/[$,]/g, ''));
          if (!isNaN(pv) && pv >= 0) item.price = pv;
        }
        if (dateKey && row[dateKey]) {
          item.purchase_date = String(row[dateKey]).trim();
        }
        return item;
      });
    setProductList(parsed);
    setProductsStatus('success');
    setProductsError('');

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
