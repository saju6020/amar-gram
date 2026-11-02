'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { SearchField } from '@/components/back-office/SearchField';
import { Button } from '@/components/ui/button';
import type { PosSku } from '@/lib/api/pos';
import { useScanner } from '@/lib/hooks/useScanner';
import { usePosBarcodeLookup, usePosSkuSearch } from '@/lib/hooks/usePos';
import { PosBrowseGrid } from './PosBrowseGrid';
import { POS_TILE_GRID, PosSkuTile } from './PosSkuTile';

/**
 * `components/pos/PosScanField.tsx` — ⭐ HO-ORD-002 §11.11, ADR-FE-095, HW-2; HO-P4 S2 (§11.3.6). The
 * always-focused scan input, now the design's leaf-bordered `SearchField emphasis="scan"`. A barcode
 * scanner is a keyboard that types fast and ends with Enter (`useScanner`); Enter looks the barcode up on
 * the server and adds the row. Typing slowly never looks anything up until Enter. An unknown barcode is
 * announced in a polite live region, the text stays in the field, and the name search opens with it so
 * the cashier can tap the right product. The results of that search are **tap tiles** (name, variant,
 * price). Below, the category tabs and tap grid (HO-P5 BG-6, `PosBrowseGrid`) browse the sellable items;
 * once a name is typed into the search its results replace the grid, so the scan and search keep priority.
 * Focus returns to the scan field after every add (the parent focuses `inputRef`).
 */
export function PosScanField({ inputRef, onAdd }: { inputRef: RefObject<HTMLInputElement | null>; onAdd: (sku: PosSku) => string }) {
  const lookup = usePosBarcodeLookup();
  const [announcement, setAnnouncement] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const search = usePosSkuSearch(searchOpen ? searchText : '');

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  // Lookups run one after another (a queue), and the field is emptied the moment Enter is pressed, so a second
  // scan arriving while the first lookup is still in flight is neither appended to it nor wiped by it.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const scanner = useScanner((code, kind) => {
    scanner.clear();
    queue.current = queue.current.then(() => process(code, kind));
  });

  async function process(code: string, kind: 'scan' | 'manual'): Promise<void> {
    // On a failure the text goes back into the field (unless a newer scan is already in it).
    const restore = () => scanner.setValue((current) => (current === '' ? code : current));
    try {
      const sku = await lookup.mutateAsync(code);
      if (!sku) {
        setAnnouncement(`No product has barcode ${code}. Check the number or search by name.`);
        setSearchText((current) => (current === '' ? code : current));
        setSearchOpen(true);
        restore();
        return;
      }
      setAnnouncement(onAdd(sku));
    } catch {
      setAnnouncement(`Could not look up ${kind === 'scan' ? 'the scanned' : 'that'} barcode. Try again or search by name.`);
      restore();
    }
  }

  const results = search.data ?? [];
  // A name typed into the search replaces the browse grid with its results (HO-P5 §11.3.11).
  const searching = searchOpen && searchText.trim() !== '';
  return (
    <div className="flex flex-col gap-3">
      <SearchField
        id="pos-scan"
        label="Scan a barcode"
        emphasis="scan"
        placeholder="Scan barcode or type a name"
        value={scanner.value}
        onChange={scanner.setValue}
        onKeyDown={scanner.onKeyDown}
        inputRef={inputRef}
      />
      <p id="pos-scan-live" role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-accent-ink">
        {announcement}
      </p>
      <div>
        <Button variant="secondary" size="sm" onClick={() => setSearchOpen((o) => !o)} aria-expanded={searchOpen}>
          <Search size={14} aria-hidden="true" />
          Search by name
        </Button>
      </div>
      {searchOpen && (
        <div className="flex flex-col gap-3">
          <SearchField id="pos-search" label="Product name or code" placeholder="Product name or code" value={searchText} onChange={setSearchText} />
          {searching && (
            <ul aria-label="Search results" className={POS_TILE_GRID}>
              {results.map((sku) => (
                <li key={sku.skuId} className="min-w-0">
                  <PosSkuTile sku={sku} onAdd={(picked) => setAnnouncement(onAdd(picked))} />
                </li>
              ))}
            </ul>
          )}
          {searching && !search.isFetching && results.length === 0 && (
            <p className="text-sm text-ink-muted">No product matches “{searchText.trim()}”.</p>
          )}
        </div>
      )}
      {/* The scan field and the name search keep priority: a typed query shows its results instead of the grid. */}
      {!searching && <PosBrowseGrid onAdd={(picked) => setAnnouncement(onAdd(picked))} />}
    </div>
  );
}
