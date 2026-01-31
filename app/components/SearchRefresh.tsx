'use client';

import { useState, useEffect } from 'react';
import { island } from 'melina/island';

function SearchRefreshImpl() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        // Trigger a navigation to refresh the page data
        window.location.reload();
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        // Could dispatch event to filter processes
        window.dispatchEvent(new CustomEvent('bgr:search', {
            detail: { query: e.target.value }
        }));
    };

    return (
        <div className="search-refresh">
            <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search processes..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="search-input"
                />
            </div>
            <button
                className="btn btn-ghost refresh-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh"
            >
                <span className={isRefreshing ? 'spinning' : ''}>🔄</span>
            </button>
        </div>
    );
}

export const SearchRefresh = island(SearchRefreshImpl, 'SearchRefresh');
