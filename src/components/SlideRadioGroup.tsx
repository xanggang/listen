'use client';

import React, { useMemo } from 'react';
import classNames from 'classnames';
import styles from './SlideRadioGroup.module.scss';
import { FilterEnums } from '@/types'

export interface SlideRadioGroupOption {
  label: string;
  value: FilterEnums
}

export interface SlideRadioGroupProps {
  value?: FilterEnums;
  options?: SlideRadioGroupOption[];
  disabled?: boolean;
  onChange?: (value: FilterEnums) => void;
  className?: string;
}

const SlideRadioGroup: React.FC<SlideRadioGroupProps> = ({
  value = '',
  options = [],
  disabled = false,
  onChange,
  className,
}) => {
  const activeIndex = useMemo(() => {
    return options.findIndex((option) => option.value === value);
  }, [options, value]);

  const handleSelect = (selectedValue: FilterEnums) => {
    if (disabled) return;
    onChange?.(selectedValue);
  };

  return (
    <div
      className={classNames(
        styles.slideRadioGroup,
        { [styles.disabled]: disabled },
        className
      )}
    >
      {options.map((option) => (
        <div
          key={option.value}
          className={classNames(styles.radioItem, {
            [styles.active]: option.value === value,
          })}
          onClick={() => handleSelect(option.value)}
        >
          {option.label}
        </div>
      ))}
      <div className={styles.activeSliderWrap}>
        <div
          className={styles.activeSlider}
          style={{
            width: options.length > 1 ? `${100 / options.length}%` : '100%',
            left: `${activeIndex * (100 / options.length)}%`,
          }}
        />
      </div>
    </div>
  );
};

export default SlideRadioGroup;
