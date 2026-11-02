'use client';

import { Suspense, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { SplitView } from '@/components/back-office/SplitView';
import { CustomerProfileView } from '@/components/back-office-overview/CustomerProfileView';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';
import { CustomerBrowsePanel } from '@/components/customer/CustomerBrowsePanel';
import { ApiForbiddenError } from '@/lib/api/client';
import type { CustomerListSort } from '@/lib/api/staff-customers';
import { useBrowseCustomers } from '@/lib/hooks/useStaffCustomers';
import { useUrlParams } from '@/lib/hooks/useUrlParams';

// US-ACC-10, HO-P5 §11.5.3 (BG-19, OQ-14). Customers: the browsable list (left) and the selected profile (right). The
// search term (`?search=`), tag, sort, page and the selection (`?customer=`) live in the URL, so a reload or back/forward
// keeps them (ADR-FE-183). The POS customer panel keeps its exact mobile/email lookup; this screen browses.
const PAGE_SIZE = 20;

export default function StaffCustomersPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Find a customer by name, mobile number or email."
        actions={
          <ActionLink href="/staff/customers/new" variant="primary">
            <UserPlus size={16} aria-hidden="true" />
            Register walk-in customer
          </ActionLink>
        }
      />
      <Suspense fallback={null}>
        <CustomersSplit />
      </Suspense>
    </div>
  );
}

function CustomersSplit() {
  const url = useUrlParams();
  const search = url.get('search').trim();
  const tag = url.get('tag').trim();
  const sort: CustomerListSort = url.get('sort') === 'name' ? 'name' : 'recent';
  const page = Math.max(1, Math.trunc(Number(url.get('page'))) || 1);
  const selectedId = url.get('customer');

  const browse = useBrowseCustomers({
    search: search || undefined,
    tag: tag || undefined,
    sort,
    pageNumber: page,
    pageSize: PAGE_SIZE,
  });

  // The tag filter offers the tags seen so far (the pages the person has looked at) and the one in the URL.
  const [seenTags, setSeenTags] = useState<string[]>([]);
  useEffect(() => {
    const onPage = browse.data?.items.flatMap((item) => item.tags) ?? [];
    if (onPage.length === 0) return;
    setSeenTags((current) => {
      const next = [...new Set([...current, ...onPage])];
      return next.length === current.length ? current : next;
    });
  }, [browse.data]);
  const tagOptions = [...new Set([...seenTags, ...(tag ? [tag] : [])])].sort((a, b) => a.localeCompare(b));

  if (browse.error instanceof ApiForbiddenError) return <PermissionDeniedState />;

  return (
    <SplitView
      listLabel="Customer list"
      detailLabel="Customer profile"
      ratio="2:3"
      list={
        <CustomerBrowsePanel
          search={search}
          onSearch={(next) => url.set({ search: next, customer: undefined })}
          tag={tag}
          tagOptions={tagOptions}
          onTag={(next) => url.set({ tag: next, customer: undefined })}
          sort={sort}
          onSort={(next) => url.set({ sort: next === 'recent' ? undefined : next })}
          page={page}
          onPage={(next) => url.set({ page: next === 1 ? undefined : String(next) })}
          items={browse.data?.items}
          totalCount={browse.data?.totalCount}
          pageSize={PAGE_SIZE}
          isLoading={browse.isLoading}
          isRefreshing={browse.isPlaceholderData}
          isError={browse.isError}
          onRetry={() => void browse.refetch()}
          selectedId={selectedId}
          onSelect={(customerId) => url.set({ customer: customerId, page: page === 1 ? undefined : String(page) })}
        />
      }
      detail={selectedId ? <CustomerProfileView key={selectedId} customerId={selectedId} headingLevel={2} /> : null}
    />
  );
}
