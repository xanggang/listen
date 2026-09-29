'use client';

interface SearchInputProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
}

/** 发现页搜索框与安卓端一样保持圆角和独立的清空入口。 */
export default function SearchInput({ keyword, onKeywordChange, onSearch, placeholder }: SearchInputProps) {
  return (
    <form
      className="search-field"
      onSubmit={
        /** 提交时立即使用当前关键词，不等待防抖。 */
        (event) => { event.preventDefault(); onSearch(keyword); }
      }
      role="search"
    >
      <span className="iconfont icon-sousuo3" aria-hidden="true" />
      <input
        type="search"
        value={keyword}
        onChange={
          /** 输入时更新受控值，列表请求仍由页面防抖。 */
          (event) => onKeywordChange(event.target.value)
        }
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {keyword && (
        <button type="button" aria-label="Clear search" onClick={
          /** 同时清空输入与结果筛选。 */
          () => { onKeywordChange(''); onSearch(''); }
        }>×</button>
      )}
    </form>
  );
}
