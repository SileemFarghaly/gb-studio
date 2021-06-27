import React, { useCallback, useEffect, useRef, useState } from "react";
import { OptGroup } from "ui/form/Select";
import events, { EventHandler } from "lib/events";
import l10n from "lib/helpers/l10n";
import styled, { css } from "styled-components";
import { Menu, MenuGroup, MenuItem } from "ui/menu/Menu";
import { CaretRightIcon, StarIcon } from "ui/icons/Icons";
import { FlexGrow } from "ui/spacing/Spacing";
import { Button } from "ui/buttons/Button";
import Fuse from "fuse.js";
import { Dictionary } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import settingsActions from "store/features/settings/settingsActions";
import { RootState } from "store/configureStore";

interface AddScriptEventMenuProps {
  onChange?: (addValue: EventHandler) => void;
  onBlur?: () => void;
}

type MenuElement = HTMLDivElement & {
  scrollIntoViewIfNeeded: (center: boolean) => void;
};

interface EventOption {
  label: string;
  value: string;
  group?: string;
  groupLabel?: string;
  isFavorite: boolean;
  event: EventHandler;
}

interface EventOptGroup {
  label: string;
  groupLabel?: string;
  options: EventOption[];
}

const MENU_HEADER_HEIGHT = 68;
const MENU_ITEM_HEIGHT = 25;
const MENU_GROUP_HEIGHT = 25;
const MENU_GROUP_SPACER = 10;

const eventToOption =
  (favorites: string[]) =>
  (event: EventHandler): EventOption => {
    const localisedKey = l10n(event.id); //.replace(/[^:*]*:[ ]*/g, "");
    const name =
      localisedKey !== event.id ? localisedKey : event.name || event.id;
    const groupName = (("groups" in event && event.groups) || [])
      .map((key) => l10n(key))
      .join(" ");

    return {
      label: name,
      group: groupName,
      value: event.id,
      event,
      isFavorite: favorites.includes(event.id),
    };
  };

const SelectMenu = styled.div`
  min-width: 280px;

  ${Menu} {
    width: 100%;
    height: 450px;
    min-height: 300px;
    max-height: min(80vh, 700px);
    overflow: hidden;
  }
`;

const SelectMenuSearchWrapper = styled.div`
  display: flex;
  padding: 5px;
  box-sizing: border-box;
`;

const SelectMenuInput = styled.input`
  background: ${(props) => props.theme.colors.input.background};
  color: ${(props) => props.theme.colors.input.text};
  border: 1px solid ${(props) => props.theme.colors.input.border};
  font-size: ${(props) => props.theme.typography.fontSize};
  border-radius: ${(props) => props.theme.borderRadius}px;
  padding: 5px;
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  :focus {
    border: 2px solid ${(props) => props.theme.colors.highlight};
    background: ${(props) => props.theme.colors.input.activeBackground};
    box-shadow: none;
  }
`;

const SelectMenuTitle = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 30px;
`;

const SelectMenuBackButton = styled.button`
  opacity: 0;
  border: 0px;
  height: 100%;
  background: transparent;
  svg {
    width: 10px;
    height: 10px;
    transform: scaleX(-1);
    fill: ${(props) => props.theme.colors.button.text};
  }
`;

interface SelectMenuHeaderProps {
  isOpen: boolean;
}

const SelectMenuHeader = styled.div<SelectMenuHeaderProps>`
  position: relative;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  ${SelectMenuTitle}:nth-child(1) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    transition: transform 0.2s linear, opacity 0.2s linear;
  }
  ${SelectMenuTitle}:nth-child(2) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    opacity: 0;
    transform: translateX(80px);
    transition: transform 0.2s linear, opacity 0.2s linear;
  }
  ${SelectMenuBackButton} {
    transition: opacity 0.2s linear;
    opacity: 0;
  }

  ${(props) =>
    props.isOpen
      ? css`
          ${SelectMenuTitle}:nth-child(1) {
            transform: translateX(-80px);
            opacity: 0;
          }
          ${SelectMenuTitle}:nth-child(2) {
            transform: translateX(0px);
            opacity: 1;
          }
          ${SelectMenuBackButton} {
            opacity: 1;
          }
        `
      : ""}
`;

interface SelectMenuOptionsWrapperProps {
  isOpen: boolean;
}

const SelectMenuOptionsWrapper = styled.div<SelectMenuOptionsWrapperProps>`
  width: 200%;
  display: flex;
  flex-grow: 1;
  height: 0px;
  flex-grow: 1;
  transition: transform 0.2s ease-in-out;
  ${(props) =>
    props.isOpen
      ? css`
          transform: translateX(-50%);
        `
      : ""}
`;

const SelectMenuOptions = styled.div`
  width: 50%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  flex-shrink: 0;
`;

const MenuItemCaret = styled.div`
  flex-grow: 1;
  text-align: right;
  svg {
    display: inline-block;
    width: 10px;
    height: 10px;
    fill: ${(props) => props.theme.colors.text};
  }
`;

interface MenuItemFavoriteProps {
  visible: boolean;
  isFavorite: boolean;
}

const MenuItemFavorite = styled.div<MenuItemFavoriteProps>`
  opacity: 0;
  svg {
    display: inline-block;
    width: 10px;
    height: 10px;
    fill: ${(props) => props.theme.colors.text};
  }

  ${Button} {
    height: 18px;
    padding: 0;
    margin: -10px -5px;
    transition: all 0.1s ease-out;
  }

  ${(props) =>
    props.visible
      ? css`
          opacity: 1;
        `
      : ""}
  ${(props) =>
    !props.isFavorite
      ? css`
          svg {
            opacity: 0.3;
          }

          ${Button}:active {
            transform: scale(1.5);
            svg {
              opacity: 1;
            }
          }
        `
      : ""}      
  ${MenuItem}:hover > & {
    opacity: 1;
  }
`;

const sortAlphabetically = (a: string, b: string) => {
  if (a === b) {
    return 0;
  } else if (a === "EVENT_GROUP_MISC") {
    return 1;
  } else if (b === "EVENT_GROUP_MISC") {
    return -1;
  }
  return a < b ? -1 : 1;
};

const sortAlphabeticallyByLabel = (
  a: { label: string },
  b: { label: string }
) => {
  if (a.label === b.label) {
    return 0;
  } else if (a.label === l10n("EVENT_GROUP_MISC")) {
    return 1;
  } else if (b.label === l10n("EVENT_GROUP_MISC")) {
    return -1;
  }
  return a.label < b.label ? -1 : 1;
};

const notDeprecated = (a: { deprecated?: boolean }) => {
  return !a.deprecated;
};

const identity = <T extends unknown>(i: T): T => i;

const AddScriptEventMenu = ({ onChange, onBlur }: AddScriptEventMenuProps) => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [options, setOptions] = useState<(EventOptGroup | EventOption)[]>([]);
  const [allOptions, setAllOptions] = useState<(EventOptGroup | EventOption)[]>(
    []
  );
  const favoriteEvents = useSelector(
    (state: RootState) => state.project.present.settings.favoriteEvents
  );
  const [favoritesCache, setFavoritesCache] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(-1);
  const [renderCategoryIndex, setRenderedCategoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootOptionsRef = useRef<HTMLDivElement>(null);
  const childOptionsRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<Fuse<EventOption> | null>(null);

  useEffect(() => {
    if (selectedCategoryIndex === -1) {
      setFavoritesCache(favoriteEvents);
    }
  }, [favoriteEvents, selectedCategoryIndex]);

  useEffect(() => {
    const eventList = (
      Object.values(events).filter(identity) as EventHandler[]
    ).filter(notDeprecated);
    fuseRef.current = new Fuse(eventList.map(eventToOption(favoriteEvents)), {
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      threshold: 0.2,
      keys: [
        "label",
        {
          name: "group",
          weight: 2,
        },
      ],
    });

    const groupedEvents = eventList.reduce((memo, event) => {
      if (Array.isArray(event.groups)) {
        event.groups.forEach((group) => {
          if (!memo[group]) {
            memo[group] = [event];
          } else {
            memo[group]?.push(event);
          }
        });
      } else {
        const group = "EVENT_GROUP_MISC";
        if (!memo[group]) {
          memo[group] = [event];
        } else {
          memo[group]?.push(event);
        }
      }
      return memo;
    }, {} as Dictionary<EventHandler[]>);

    const groupKeys = Object.keys(groupedEvents).sort(sortAlphabetically);

    const allOptions = ([] as (EventOptGroup | EventOption)[]).concat(
      (
        favoritesCache
          .map((id: string) => events[id])
          .filter(identity) as EventHandler[]
      )
        .map(eventToOption(favoriteEvents))
        .sort(sortAlphabeticallyByLabel)
        .map((option, optionIndex) => {
          if (optionIndex === 0) {
            return {
              ...option,
              groupLabel: l10n("FIELD_FAVORITES"),
            };
          }
          return option;
        }),
      groupKeys
        .map((key: string) => ({
          label: key === "" ? l10n("EVENT_GROUP_MISC") : l10n(key),
          options: (groupedEvents[key] || [])
            .map(eventToOption(favoriteEvents))
            .sort(sortAlphabeticallyByLabel),
        }))
        .sort(sortAlphabeticallyByLabel)
        .map((option, optionIndex) => {
          if (optionIndex === 0) {
            return {
              ...option,
              groupLabel: l10n("FIELD_CATEGORIES"),
            };
          }
          return option;
        })
    );
    setAllOptions(allOptions);
  }, [favoriteEvents, favoritesCache]);

  useEffect(() => {
    if (searchTerm && fuseRef.current) {
      setOptions(fuseRef.current.search(searchTerm).map((res) => res.item));
      setSelectedIndex(0);
      setSelectedCategoryIndex(-1);
    } else {
      setOptions(allOptions);
    }
  }, [allOptions, searchTerm]);

  const scrollIntoViewIfNeeded = useCallback(
    (index: number) => {
      if (childOptionsRef.current && selectedCategoryIndex > -1) {
        const el = childOptionsRef.current.querySelector(
          `[data-index="${index}"]`
        ) as MenuElement;
        if (el) {
          el.focus();
          el.scrollIntoViewIfNeeded(false);
        }
      } else if (rootOptionsRef.current && selectedCategoryIndex === -1) {
        const el = rootOptionsRef.current.querySelector(
          `[data-index="${index}"]`
        ) as MenuElement;
        if (el) {
          el.focus();
          el.scrollIntoViewIfNeeded(false);
        }
      }
    },
    [selectedCategoryIndex]
  );

  const onSelectOption = useCallback(
    (index: number) => {
      if (
        index === -1 ||
        (selectedCategoryIndex === -1 && "options" in options[index])
      ) {
        setSelectedCategoryIndex(index);
        setRenderedCategoryIndex(index);
        setSelectedIndex(0);
        inputRef.current?.focus();
      } else if (selectedCategoryIndex === -1) {
        const option = options[index];
        if ("event" in option) {
          onChange?.(option.event);
        }
      } else {
        const categoryOption = options[selectedCategoryIndex];
        if ("options" in categoryOption) {
          const option = categoryOption.options[index];
          if ("event" in option) {
            onChange?.(option.event);
          }
        }
      }
    },
    [onChange, options, selectedCategoryIndex]
  );

  const onToggleFavouriteEventId = useCallback(
    (eventId: string) => {
      dispatch(settingsActions.toggleFavoriteEvent(eventId));
    },
    [dispatch]
  );

  const onToggleFavoriteOption = useCallback(
    (index: number) => {
      if (selectedCategoryIndex === -1) {
        const option = options[index];
        if ("event" in option) {
          onToggleFavouriteEventId(option.event.id);
        }
      } else {
        const categoryOption = options[selectedCategoryIndex];
        if ("options" in categoryOption) {
          const option = categoryOption.options[index];
          if ("event" in option) {
            onToggleFavouriteEventId(option.event.id);
          }
        }
      }
    },
    [onToggleFavouriteEventId, options, selectedCategoryIndex]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (searchTerm.length > 0) {
          setSelectedIndex(0);
          setSelectedCategoryIndex(-1);
          setSearchTerm("");
        } else if (selectedCategoryIndex === -1) {
          onBlur?.();
        } else {
          setSelectedIndex(selectedCategoryIndex);
          setSelectedCategoryIndex(-1);
        }
      } else if (e.key === "ArrowDown") {
        const max =
          selectedCategoryIndex === -1
            ? options.length - 1
            : (options[selectedCategoryIndex] as OptGroup)?.options?.length - 1;
        setSelectedIndex(Math.min(selectedIndex + 1, max));
        scrollIntoViewIfNeeded(Math.min(selectedIndex + 1, max));
      } else if (e.key === "ArrowUp") {
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
        scrollIntoViewIfNeeded(selectedIndex - 1);
      } else if (e.key === "Enter") {
        onSelectOption(selectedIndex);
      } else if (e.key === "Tab") {
        e.preventDefault();
        onToggleFavoriteOption(selectedIndex);
      }
    },
    [
      onBlur,
      onSelectOption,
      onToggleFavoriteOption,
      options,
      scrollIntoViewIfNeeded,
      searchTerm.length,
      selectedCategoryIndex,
      selectedIndex,
    ]
  );

  const onChangeSearchTerm = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.currentTarget.value;
      if (value.trim() === "") {
        setSearchTerm("");
      } else {
        setSearchTerm(e.currentTarget.value);
      }
    },
    []
  );

  const menuHeight =
    MENU_HEADER_HEIGHT +
    allOptions.length * MENU_ITEM_HEIGHT +
    MENU_GROUP_HEIGHT +
    (favoriteEvents.length > 0 ? MENU_GROUP_HEIGHT + MENU_GROUP_SPACER : 0);

  if (allOptions.length === 0) {
    return null;
  }

  return (
    <SelectMenu>
      <Menu style={{ height: menuHeight }}>
        <SelectMenuHeader
          isOpen={!searchTerm && selectedCategoryIndex > -1}
          onClick={() => onSelectOption(-1)}
        >
          <SelectMenuTitle>Add Event</SelectMenuTitle>
          <SelectMenuTitle>
            {renderCategoryIndex > -1 && options[renderCategoryIndex]?.label}
          </SelectMenuTitle>
          <SelectMenuBackButton>
            <CaretRightIcon />
          </SelectMenuBackButton>
        </SelectMenuHeader>
        <SelectMenuSearchWrapper>
          <SelectMenuInput
            ref={inputRef}
            autoFocus
            value={searchTerm}
            placeholder={l10n("TOOLBAR_SEARCH")}
            onKeyDown={onKeyDown}
            onChange={onChangeSearchTerm}
          />
        </SelectMenuSearchWrapper>
        <SelectMenuOptionsWrapper
          isOpen={!searchTerm && selectedCategoryIndex > -1}
        >
          <SelectMenuOptions ref={rootOptionsRef}>
            {options.map((option, optionIndex) => (
              <>
                {option.groupLabel && (
                  <MenuGroup key={option.groupLabel}>
                    {option.groupLabel}
                  </MenuGroup>
                )}
                <MenuItem
                  key={option.label}
                  data-index={optionIndex}
                  selected={
                    (selectedCategoryIndex === -1 &&
                      selectedIndex === optionIndex) ||
                    selectedCategoryIndex === optionIndex
                  }
                  onMouseOver={() => setSelectedIndex(optionIndex)}
                  onClick={() => onSelectOption(optionIndex)}
                >
                  {option.label}
                  {"options" in option ? (
                    <MenuItemCaret>
                      <CaretRightIcon />
                    </MenuItemCaret>
                  ) : (
                    <>
                      <FlexGrow />
                      <MenuItemFavorite
                        visible={
                          (selectedCategoryIndex === -1 &&
                            selectedIndex === optionIndex) ||
                          selectedCategoryIndex === optionIndex ||
                          ("isFavorite" in option && option.isFavorite)
                        }
                        isFavorite={option.isFavorite}
                      >
                        <Button
                          size="small"
                          variant="transparent"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleFavoriteOption(optionIndex);
                          }}
                        >
                          <StarIcon />
                        </Button>
                      </MenuItemFavorite>
                    </>
                  )}
                </MenuItem>
              </>
            ))}
          </SelectMenuOptions>
          <SelectMenuOptions ref={childOptionsRef}>
            {renderCategoryIndex > -1 &&
              (options[renderCategoryIndex] as EventOptGroup)?.options &&
              (options[renderCategoryIndex] as EventOptGroup).options.map(
                (childOption, childOptionIndex) => (
                  <MenuItem
                    key={childOption.value}
                    data-index={childOptionIndex}
                    selected={selectedIndex === childOptionIndex}
                    onMouseOver={() => setSelectedIndex(childOptionIndex)}
                    onClick={() => onSelectOption(childOptionIndex)}
                  >
                    {childOption.label}
                    <FlexGrow />
                    <MenuItemFavorite
                      visible={
                        selectedIndex === childOptionIndex ||
                        childOption.isFavorite
                      }
                      isFavorite={childOption.isFavorite}
                    >
                      <Button
                        size="small"
                        variant="transparent"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleFavoriteOption(childOptionIndex);
                        }}
                      >
                        <StarIcon />
                      </Button>
                    </MenuItemFavorite>
                  </MenuItem>
                )
              )}
          </SelectMenuOptions>
        </SelectMenuOptionsWrapper>
      </Menu>
    </SelectMenu>
  );
};

export default AddScriptEventMenu;