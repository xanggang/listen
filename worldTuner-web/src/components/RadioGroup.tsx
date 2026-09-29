'use client';

interface Option {
  label: string
  value: number
}

interface Props {
  options: Option[],
  onChange: (o: number) => void
  value?: number
}

/** 绘制可横向滚动的数字 id 筛选项，并向调用方回传选中值。 */
export default function RadioGroup( { options, onChange, value }: Props) {

  return (
    <div className="flex space-x-4 overflow-x-auto pb-2">
      {
        options.map(
          /** 每个筛选项只负责把固定 id 回传给页面。 */
          (item, index) => {
          return (
            <div
              key={index}
              onClick={() => onChange(item.value)}
              className={`radio-item ${value === item.value ? 'active' : ''} dark:bg-gray-700 dark:text-white!`}
            > { item.label } </div>
          )
        },
        )
      }

      <style jsx>{`
          .radio-item {
              display: inline-block;
              padding: calc(var(--text-size-xs) / 2) calc(var(--text-size-xs));
              background: var(--bg-base-1);
              color: var(--text-black);
              font-size: var(--text-size-base);
              border-radius: calc(var(--text-size-xs) / 4);
              font-weight: bold;
              flex-shrink: 0;

              &.active {
                  background: var(--primary);
                  color: var(--bg-surface);
              }

          }
      `}</style>
    </div>
  )
}
