"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getConportClient } from '@/shared/conport/client';
import LinkItemsModal from './LinkItemsModal';

interface RelatedItemsSectionProps {
  linkedItems: any[];
  currentItemType: string;
  currentItemId: string;
  onRefresh: () => Promise<void>;
  isEditing?: boolean;
}

export default function RelatedItemsSection({
  linkedItems,
  currentItemType,
  currentItemId,
  onRefresh,
  isEditing = false
}: RelatedItemsSectionProps) {
  const router = useRouter();
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  
  // BUGFIX Progress #99: Pre-fetch ONLY the custom_data items referenced in links
  const [customDataCache, setCustomDataCache] = useState<Map<string, any>>(new Map());
  
  useEffect(() => {
    // Extract numeric custom_data IDs from linkedItems
    const numericCustomDataIds = linkedItems
      .filter((link: any) =>
        (link.source_item_type === 'custom_data' && /^\d+$/.test(link.source_item_id)) ||
        (link.target_item_type === 'custom_data' && /^\d+$/.test(link.target_item_id))
      )
      .flatMap((link: any) => {
        const ids: string[] = [];
        if (link.source_item_type === 'custom_data' && /^\d+$/.test(link.source_item_id)) {
          ids.push(link.source_item_id);
        }
        if (link.target_item_type === 'custom_data' && /^\d+$/.test(link.target_item_id)) {
          ids.push(link.target_item_id);
        }
        return ids;
      });
    
    // Remove duplicates
    const uniqueIds = Array.from(new Set(numericCustomDataIds));
    
    // Only fetch if we have numeric IDs to resolve
    if (uniqueIds.length > 0) {
      const client = getConportClient();
      client.call('get_items_by_references', {
        workspace_id: '',
        references: uniqueIds.map(id => ({ type: 'custom_data', id }))
      }).then((response: any) => {
        // Handle MCP response structure - extract actual results array
        const results = response?.result || response || [];
        const resultsArray = Array.isArray(results) ? results : [];
        
        const cache = new Map();
        resultsArray.forEach((result: any) => {
          if (result.success && result.item) {
            cache.set(result.reference.id, result.item);
          }
        });
        setCustomDataCache(cache);
      }).catch((error: any) => {
        console.error('Failed to fetch custom data for links:', error);
      });
    }
  }, [linkedItems]);

  const handleDeleteLink = async (linkId: number) => {
    const confirmed = confirm('Are you sure you want to delete this link? This action cannot be undone.');
    if (!confirmed) return;
    
    setDeletingLinkId(linkId);
    try {
      const client = getConportClient();
      await client.deleteLink({ link_id: linkId });
      
      // Refresh the linked items and force page reload to clear any cached state
      await onRefresh();
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete link:', error);
      alert('Failed to delete link. Please try again.');
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleNavigateToItem = (link: any) => {
    const isSource = link.source_item_type === currentItemType && link.source_item_id === currentItemId;
    const targetType = isSource ? link.target_item_type : link.source_item_type;
    const targetId = isSource ? link.target_item_id : link.source_item_id;
    
    // Navigate to the appropriate page based on item type
    switch (targetType) {
      case 'decision':
        router.push(`/decisions/${targetId}`);
        break;
      case 'progress_entry':
        router.push(`/progress/${targetId}`);
        break;
      case 'system_pattern':
        router.push(`/patterns/${targetId}`);
        break;
      case 'custom_data':
        // BUGFIX Progress #99: Handle both numeric IDs (legacy) and category:key format
        const customItemId = isSource ? link.target_item_id : link.source_item_id;
        
        if (customItemId.includes(':')) {
          // Already in category:key format
          router.push(`/custom/${customItemId}`);
        } else {
          // Numeric ID - convert to category:key using cached data
          const customItem = customDataCache.get(customItemId);
          
          if (customItem) {
            const categoryKey = `${customItem.category}:${customItem.key}`;
            router.push(`/custom/${encodeURIComponent(categoryKey)}`);
          } else {
            alert(`Cannot navigate: Custom data #${customItemId} not yet loaded. Please try again.`);
          }
        }
        break;
      default:
        console.warn(`Unknown target type: ${targetType}`);
    }
  };

  const getRelationshipBadgeColor = (itemType: string) => {
    switch (itemType) {
      case 'decision':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
      case 'progress_entry':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'system_pattern':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'custom_data':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  const hasLinkedItems = linkedItems && linkedItems.length > 0;

  // Show section if there are linked items OR if we're in edit mode
  if (!hasLinkedItems && !isEditing) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Related Items
        </h3>
        {isEditing && (
          <button
            onClick={() => setShowLinkModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Link
          </button>
        )}
      </div>
      <div className="space-y-3">
        {linkedItems.map((link: any) => (
          <div 
            key={`${link.source_item_type}-${link.source_item_id}-${link.target_item_type}-${link.target_item_id}`}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors relative group"
          >
            <div 
              className="cursor-pointer"
              onClick={() => handleNavigateToItem(link)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-1 text-xs rounded ${getRelationshipBadgeColor(currentItemType)}`}>
                  {link.relationship_type}
                </span>
                {/* Delete Link Button - Always visible */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLink(link.id);
                  }}
                  disabled={deletingLinkId === link.id}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200 disabled:opacity-50"
                  title="Delete link"
                >
                  {deletingLinkId === link.id ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-300 border-t-red-500"></div>
                  ) : (
                    <span className="text-sm">🗑️</span>
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-900 dark:text-white font-medium">
                {link.source_item_type === currentItemType && link.source_item_id === currentItemId
                  ? `→ ${link.target_item_type} #${link.target_item_id}`
                  : `← ${link.source_item_type} #${link.source_item_id}`
                }
              </p>
              {link.description && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {link.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!hasLinkedItems && isEditing && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">🔗</div>
          <p className="text-sm">No related items yet</p>
          <p className="text-xs">Click "Add Link" to create relationships with other items</p>
        </div>
      )}

      {/* Link Items Modal */}
      <LinkItemsModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        currentItemType={currentItemType}
        currentItemId={currentItemId}
        onLinkCreated={async () => {
          await onRefresh();
          setShowLinkModal(false);
        }}
      />
    </div>
  );
}