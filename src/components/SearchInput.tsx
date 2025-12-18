'use client';

import { useRef, useState, KeyboardEvent, ChangeEvent, FormEvent } from 'react';
import styles from './SearchInput.module.scss';

interface SearchInputProps {
  keyword?: string;
  onKeywordChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({
  keyword = '',
  onKeywordChange,
  onSearch,
  placeholder = 'search',
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocus, setIsFocus] = useState(false);

  const onInputFocus = () => {
    setIsFocus(true);
  };

  const onInputBlur = () => {
    setIsFocus(false);
  };

  const handleReset = () => {
    if (onKeywordChange) {
      onKeywordChange('');
    }
    // Optional: focus back on input after reset
    inputRef.current?.focus();
  };

  const handleSearchAction = () => {
    if (onSearch) {
      onSearch(keyword);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchAction();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onKeywordChange) {
      onKeywordChange(e.target.value);
    }
  };

  // Handle native search event
  const handleNativeSearch = (e: any) => {
    handleSearchAction();
  };

  return (
    <div className={styles.searchForm}>
      <div className={`${styles.label} rounded-xl ${isFocus ? 'is-focus' : ''}`}>
        <input
          ref={inputRef}
          autoComplete="off"
          placeholder={placeholder}
          id="search"
          type="search"
          value={keyword}
          onChange={handleChange}
          onBlur={onInputBlur}
          onFocus={onInputFocus}
          onKeyDown={handleKeyDown}
          required
        />
        <div className={styles.icon}>
          {/* icon-array */}
          <svg
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.iconArray}
          >
            <path
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              strokeLinejoin="round"
              strokeLinecap="round"
            ></path>
          </svg>
          {/* icon-search (arrow) */}
          <svg
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.iconSearch}
          >
            <path
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
              strokeLinejoin="round"
              strokeLinecap="round"
            ></path>
          </svg>
        </div>
        <button
            type="button"
            onClick={handleReset}
            className={styles.closeBtn}
            aria-label="Clear search"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg">
            <path
              clipRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              fillRule="evenodd"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
