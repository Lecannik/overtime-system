/* eslint-disable */
import React from 'react';
import ReviewCard from './ReviewCard';
import type { Overtime, User } from '../../../types';

interface ReviewTableViewProps {
    overtimes: Overtime[];
    currentUser: User | null;
    selectedIds: number[];
    onToggleSelect: (id: number) => void;
    onOpenDetail: (ot: Overtime) => void;
    reviewingId: number | null;
    onToggleReview: (id: number | null) => void;
    inlineFormRenderer: (ot: Overtime) => React.ReactNode;
}

const ReviewTableView: React.FC<ReviewTableViewProps> = ({
    overtimes,
    currentUser,
    selectedIds,
    onToggleSelect,
    onOpenDetail,
    reviewingId,
    onToggleReview,
    inlineFormRenderer,
}) => {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                gap: '16px',
            }}
        >
            {overtimes.map(ot => (
                <ReviewCard
                    key={ot.id}
                    overtime={ot}
                    currentUser={currentUser}
                    isReviewing={reviewingId === ot.id}
                    isSelected={selectedIds.includes(ot.id)}
                    onOpenDetail={onOpenDetail}
                    onToggleReview={onToggleReview}
                    onToggleSelect={onToggleSelect}
                    inlineForm={inlineFormRenderer(ot)}
                />
            ))}
        </div>
    );
};

export default ReviewTableView;
