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
              className={`radio-item ${value === item.value ? 'active' : ''}`}
            > { item.label } </div>
          )
        })
      }

      <style jsx>{`
          .radio-item {
              display: inline-block;
              padding: var(--text-size-xs) var(--text-size-xs);
              background: var(--bg-base);
              color: var(--text-black);
              font-size: var(--text-size-base);
              border-radius: calc(var(--text-size-xs) / 2);
              font-weight: bold;
              flex-shrink: 0;

              &.active {
                  background: var(--primary);
                  color: var(--text-base-inv);
              }
          }
      `}</style>
    </div>
  )
}
