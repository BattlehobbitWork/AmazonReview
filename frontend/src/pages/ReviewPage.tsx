import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ExternalLink, ChevronLeft, ChevronRight, Copy, RefreshCw,
  Plus, Download, Loader2, AlertCircle, Info, PenLine, CheckCircle2,
  Flag, MessageSquarePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import StarRating from '@/components/StarRating';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { apiClient } from '@/lib/api';
import type { ProductInfo, LLMSettings } from '@/lib/api';
import { toast } from 'sonner';

interface SampleReview {
  star_rating: number;
  review_text: string;
}

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

interface ProductDraft {
  starRating: number;
  reviewTitle: string;
  reviewText: string;
  reviewHistory: string[];
  historyIndex: number;
  productInfo: ProductInfo | null;
  manualMode: boolean;
  manualDescription: string;
  manualRating: string;
  additionalContext: string;
}

export default function ReviewPage() {
  const [productList] = useLocalStorage<ProductItem[]>('productList', []);
  const [sampleReviews] = useLocalStorage<SampleReview[]>('sampleReviews', []);
  const [currentIndex, setCurrentIndex] = useLocalStorage<number>('currentProductIndex', 0);
  const [outputReviews, setOutputReviews] = useLocalStorage<OutputReview[]>('outputReviews', []);
  const [llmSettings] = useLocalStorage<LLMSettings>('llmSettings', {});
  const [allDrafts, setAllDrafts] = useLocalStorage<Record<string, ProductDraft>>('productDrafts', {});
  const [flaggedProducts, setFlaggedProducts] = useLocalStorage<string[]>('flaggedProducts', []);

  const [starRating, setStarRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [reviewHistory, setReviewHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [manualRating, setManualRating] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const flaggedRef = useRef<HTMLDivElement>(null);

  const currentProduct = productList[currentIndex] || null;
  const prevAsinRef = useRef<string | null>(currentProduct?.asin ?? null);

  // Helper to persist draft for a given ASIN
  const persistDraft = useCallback((asin: string, draft: ProductDraft) => {
    setAllDrafts((prev) => ({ ...prev, [asin]: draft }));
  }, [setAllDrafts]);

  // Build a draft object from current editor state
  const currentDraftSnapshot = useCallback((): ProductDraft => ({
    starRating, reviewTitle, reviewText, reviewHistory, historyIndex,
    productInfo, manualMode, manualDescription, manualRating, additionalContext,
  }), [starRating, reviewTitle, reviewText, reviewHistory, historyIndex, productInfo, manualMode, manualDescription, manualRating, additionalContext]);

  const isFlagged = currentProduct ? flaggedProducts.includes(currentProduct.asin) : false;

  const toggleFlag = useCallback(() => {
    if (!currentProduct) return;
    setFlaggedProducts((prev) =>
      prev.includes(currentProduct.asin)
        ? prev.filter((a) => a !== currentProduct.asin)
        : [...prev, currentProduct.asin]
    );
  }, [currentProduct, setFlaggedProducts]);

  // Close flagged panel on outside click
  useEffect(() => {
    if (!showFlagged) return;
    const handler = (e: MouseEvent) => {
      if (flaggedRef.current && !flaggedRef.current.contains(e.target as Node)) setShowFlagged(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFlagged]);

  // Check if current product is already in output
  const isReviewed = currentProduct
    ? outputReviews.some((r) => r.asin === currentProduct.asin)
    : false;

  // Save draft for previous product, restore draft for new product on navigation
  useEffect(() => {
    const prevAsin = prevAsinRef.current;
    const newAsin = currentProduct?.asin ?? null;

    // Save draft for the product we're leaving
    if (prevAsin && prevAsin !== newAsin) {
      persistDraft(prevAsin, currentDraftSnapshot());
    }

    // Restore draft for the product we're arriving at
    if (newAsin && newAsin !== prevAsin) {
      const draft = allDrafts[newAsin];
      if (draft) {
        setStarRating(draft.starRating);
        setReviewTitle(draft.reviewTitle || '');
        setReviewText(draft.reviewText);
        setReviewHistory(draft.reviewHistory || []);
        setHistoryIndex(draft.historyIndex ?? -1);
        setProductInfo(draft.productInfo);
        setManualMode(draft.manualMode);
        setManualDescription(draft.manualDescription || '');
        setManualRating(draft.manualRating || '');
        setAdditionalContext(draft.additionalContext || '');
      } else {
        setStarRating(0);
        setReviewTitle('');
        setReviewText('');
        setReviewHistory([]);
        setHistoryIndex(-1);
        setProductInfo(null);
        setManualMode(false);
        setManualDescription('');
        setManualRating('');
        setAdditionalContext('');
      }
    }

    prevAsinRef.current = newAsin;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Auto-populate editor from synced data when editor is empty
  // Priority: allDrafts first, then fall back to outputReviews (which reliably syncs)
  useEffect(() => {
    const asin = currentProduct?.asin;
    if (!asin || reviewText) return; // only populate if editor is empty

    // Try draft first
    const draft = allDrafts[asin];
    if (draft && draft.reviewText) {
      setStarRating(draft.starRating);
      setReviewTitle(draft.reviewTitle || '');
      setReviewText(draft.reviewText);
      setReviewHistory(draft.reviewHistory || []);
      setHistoryIndex(draft.historyIndex ?? -1);
      setProductInfo(draft.productInfo);
      setManualMode(draft.manualMode);
      setManualDescription(draft.manualDescription || '');
      setManualRating(draft.manualRating || '');
      setAdditionalContext(draft.additionalContext || '');
      return;
    }

    // Fall back to outputReviews (this always syncs reliably)
    const output = outputReviews.find((r) => r.asin === asin);
    if (output) {
      setStarRating(output.star_rating);
      setReviewTitle(output.review_title || '');
      setReviewText(output.review_text);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDrafts, outputReviews, currentProduct?.asin]);

  const handleScrape = useCallback(async () => {
    if (!currentProduct) return;
    setIsScraping(true);
    try {
      const res = await apiClient.scrapeProduct(currentProduct.asin);
      if (res.data.scrape_failed) {
        toast.error('Scraping failed', { description: res.data.error_message || 'Falling back to manual entry' });
        setManualMode(true);
      } else {
        setProductInfo(res.data);
        toast.success('Product info loaded');
      }
    } catch {
      toast.error('Scraping failed', { description: 'Could not reach the server. Use manual entry.' });
      setManualMode(true);
    } finally {
      setIsScraping(false);
    }
  }, [currentProduct]);

  const handleGenerate = useCallback(async () => {
    if (!currentProduct || starRating === 0) return;

    const info: ProductInfo = manualMode
      ? {
          asin: currentProduct.asin,
          product_name: currentProduct.product_name,
          description: manualDescription || null,
          average_rating: manualRating ? parseFloat(manualRating) : null,
          scrape_failed: false,
        }
      : productInfo || {
          asin: currentProduct.asin,
          product_name: currentProduct.product_name,
          scrape_failed: true,
        };

    setIsGenerating(true);
    try {
      const res = await apiClient.generateReview({
        asin: currentProduct.asin,
        product_name: currentProduct.product_name,
        star_rating: starRating,
        product_info: info,
        sample_reviews: sampleReviews.filter(
          (r) => Math.abs(r.star_rating - starRating) <= 1
        ),
        llm_settings: llmSettings,
        additional_context: additionalContext || null,
      });
      const text = res.data.review_text;
      const title = res.data.review_title || '';
      if (reviewText) {
        setReviewHistory((prev) => [...prev, reviewText]);
      }
      setReviewTitle(title);
      setReviewText(text);
      setHistoryIndex(-1);
      // Eagerly save draft after generation
      if (currentProduct) {
        const newHistory = reviewText ? [...reviewHistory, reviewText] : reviewHistory;
        persistDraft(currentProduct.asin, {
          starRating, reviewTitle: title, reviewText: text,
          reviewHistory: newHistory, historyIndex: -1,
          productInfo, manualMode, manualDescription, manualRating, additionalContext,
        });
      }
      toast.success('Review generated', {
        description: `Model: ${res.data.model_used}${res.data.tokens_used ? ` | ${res.data.tokens_used} tokens` : ''}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate review';
      toast.error('Generation failed', { description: msg });
    } finally {
      setIsGenerating(false);
    }
  }, [currentProduct, starRating, productInfo, sampleReviews, llmSettings, reviewText, reviewHistory, manualMode, manualDescription, manualRating, additionalContext, persistDraft]);

  const handleCopy = useCallback(() => {
    const full = reviewTitle ? `${reviewTitle}\n\n${reviewText}` : reviewText;
    navigator.clipboard.writeText(full);
    toast.success('Copied to clipboard');
  }, [reviewTitle, reviewText]);

  const handleHistoryNav = useCallback((direction: 'prev' | 'next') => {
    const allVersions = [...reviewHistory, reviewText];
    const currentPos = historyIndex === -1 ? allVersions.length - 1 : historyIndex;
    const newPos = direction === 'prev' ? currentPos - 1 : currentPos + 1;
    if (newPos >= 0 && newPos < allVersions.length) {
      setHistoryIndex(newPos);
      setReviewText(allVersions[newPos]);
    }
  }, [reviewHistory, reviewText, historyIndex]);

  const handleAddToSamples = useCallback(() => {
    if (!reviewText || starRating === 0) return;
    const stored = JSON.parse(localStorage.getItem('sampleReviews') || '[]') as SampleReview[];
    stored.push({ star_rating: starRating, review_text: reviewText });
    localStorage.setItem('sampleReviews', JSON.stringify(stored));
    window.dispatchEvent(new CustomEvent('ls-write', { detail: { key: 'sampleReviews' } }));
    toast.success('Added to sample reviews');
  }, [reviewText, starRating]);

  const handleAppendToOutput = useCallback(() => {
    if (!currentProduct || !reviewText || starRating === 0) return;
    const newReview: OutputReview = {
      asin: currentProduct.asin,
      product_name: currentProduct.product_name,
      star_rating: starRating,
      review_title: reviewTitle,
      review_text: reviewText,
    };
    setOutputReviews((prev) => [...prev, newReview]);
    // Eagerly save draft after appending
    if (currentProduct) {
      persistDraft(currentProduct.asin, currentDraftSnapshot());
    }
    toast.success('Review appended to output');
  }, [currentProduct, reviewText, reviewTitle, starRating, setOutputReviews, persistDraft, currentDraftSnapshot]);

  const handleExportDownload = useCallback(async () => {
    try {
      const format = localStorage.getItem('outputFormat')?.replace(/"/g, '') || 'csv';
      const res = await apiClient.exportReviews(outputReviews as unknown as Record<string, unknown>[], format);
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviews.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.error('Export failed');
    }
  }, [outputReviews]);

  if (productList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Products Loaded</h2>
        <p className="text-muted-foreground mb-4">
          Go to the Upload page to load your product list and sample reviews.
        </p>
        <Button onClick={() => window.location.href = '/'}>Go to Upload</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight leading-tight">
            {currentProduct?.product_name || 'Unknown Product'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{currentProduct?.asin}</Badge>
            <span className="text-sm text-muted-foreground">
              Product {currentIndex + 1} of {productList.length}
            </span>
            {isReviewed && (
              <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Reviewed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentIndex((i: number) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentIndex((i: number) => Math.min(productList.length - 1, i + 1))}
              disabled={currentIndex === productList.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant={isFlagged ? 'default' : 'outline'}
            size="sm"
            className={`gap-1.5 ${isFlagged ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : ''}`}
            onClick={toggleFlag}
          >
            <Flag className="h-3.5 w-3.5" />
            {isFlagged ? 'Flagged' : 'Flag'}
          </Button>
          {flaggedProducts.length > 0 && (
            <div className="relative" ref={flaggedRef}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowFlagged((v) => !v)}
              >
                <Flag className="h-3.5 w-3.5 text-amber-500" />
                {flaggedProducts.length}
              </Button>
              {showFlagged && (
                <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-60 overflow-y-auto rounded-lg border bg-popover p-2 shadow-md">
                  <p className="text-xs font-medium text-muted-foreground px-1 pb-1.5">Flagged Items</p>
                  {flaggedProducts.map((asin) => {
                    const idx = productList.findIndex((p) => p.asin === asin);
                    const product = productList.find((p) => p.asin === asin);
                    if (!product || idx === -1) return null;
                    return (
                      <button
                        key={asin}
                        onClick={() => { setCurrentIndex(idx); setShowFlagged(false); }}
                        className="flex items-start gap-2 w-full rounded-md px-2 py-1.5 text-xs text-left transition-colors hover:bg-accent"
                      >
                        <Flag className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{product.product_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(`https://www.amazon.com/dp/${currentProduct?.asin}`, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Open on </span>Amazon
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left column: Product Info + Star Rating */}
        <div className="space-y-4">
          {/* Product Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Product Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productInfo && !productInfo.scrape_failed ? (
                <>
                  {productInfo.description && (
                    <p className="text-sm">{productInfo.description}</p>
                  )}
                  {productInfo.average_rating && (
                    <p className="text-sm">
                      <span className="font-medium">Avg Rating:</span> {productInfo.average_rating}/5
                    </p>
                  )}
                  {productInfo.features && productInfo.features.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Features:</span>
                      <ul className="text-sm list-disc ml-4 mt-1">
                        {productInfo.features.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {productInfo.positive_themes && productInfo.positive_themes.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Positive themes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {productInfo.positive_themes.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {productInfo.negative_themes && productInfo.negative_themes.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Negative themes:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {productInfo.negative_themes.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : manualMode ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="manual-desc">Product Description</Label>
                    <Textarea
                      id="manual-desc"
                      placeholder="Paste or type product details..."
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-rating">Average Rating (optional)</Label>
                    <Input
                      id="manual-rating"
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      placeholder="e.g. 4.2"
                      value={manualRating}
                      onChange={(e) => setManualRating(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    No product info loaded yet.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleScrape} disabled={isScraping}>
                      {isScraping && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Scrape Info
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setManualMode(true)}>
                      <PenLine className="h-4 w-4 mr-1" />
                      Manual Entry
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Context */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4" />
                Your Notes
              </CardTitle>
              <CardDescription>How do you use this product? Any details the AI should know?</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g. I use this as a travel pillow for long flights, great neck support..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
                className="resize-y min-h-[60px]"
              />
            </CardContent>
          </Card>

          {/* Star Rating */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Rating</CardTitle>
              <CardDescription>How many stars for this product?</CardDescription>
            </CardHeader>
            <CardContent>
              <StarRating value={starRating} onChange={setStarRating} />
              {starRating > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {starRating} star{starRating > 1 ? 's' : ''} selected
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={starRating === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Review'
            )}
          </Button>
        </div>

        {/* Right column: Review Editor */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Review Editor</CardTitle>
                {reviewHistory.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleHistoryNav('prev')}
                      disabled={historyIndex === 0 || (historyIndex === -1 && reviewHistory.length === 0)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {historyIndex === -1 ? reviewHistory.length + 1 : historyIndex + 1}/{reviewHistory.length + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleHistoryNav('next')}
                      disabled={historyIndex === -1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="review-title" className="text-sm font-medium">Review Title</Label>
                <Input
                  id="review-title"
                  placeholder="Title will be generated with the review..."
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Textarea
                placeholder="Your review will appear here after generation..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={8}
                className="resize-y min-h-[150px] sm:min-h-[200px]"
              />

              <Separator />

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={!reviewText}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={starRating === 0 || isGenerating}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddToSamples} disabled={!reviewText || starRating === 0}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Add to </span>Samples
                </Button>
                <Button variant="outline" size="sm" onClick={handleAppendToOutput} disabled={!reviewText || starRating === 0}>
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Append to </span>Output
                </Button>
                {outputReviews.length > 0 && (
                  <Button variant="secondary" size="sm" className="col-span-2 sm:col-span-1" onClick={handleExportDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Export ({outputReviews.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
