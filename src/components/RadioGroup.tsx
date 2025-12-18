'use client';

interface Option {
  label: string
  value: string
}

interface Props {
  options: Option[],
  onChange: (o: string) => void
  value: string
}

export default function RadioGroup( { options, onChange, value }: Props) {

  return (
    <div className="flex space-x-4 overflow-x-auto pb-2">
      {
        options.map((item, index) => {
          return (
            <div
              key={index}
              onClick={() => onChange(item.value)}
              className={`radio-item ${value === item.value ? 'active' : ''} dark:bg-gray-700 dark:text-white`}
            > { item.label } </div>
          )
        })
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
                  background: var(--bg-surface);
                  color: var(--text-black);
              }
          }
      `}</style>
    </div>
  )
}
