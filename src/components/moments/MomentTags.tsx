import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Hash } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MomentTagsProps {
  onTagSelect: (tag: string) => void;
}

const tagCategories = [
  {
    category: "心情",
    tags: ["开心", "难过", "兴奋", "感动", "平静", "焦虑", "期待", "怀念"]
  },
  {
    category: "生活",
    tags: ["美食", "旅行", "运动", "阅读", "电影", "音乐", "摄影", "购物"]
  },
  {
    category: "工作",
    tags: ["加班", "出差", "会议", "学习", "思考", "创作", "团队", "项目"]
  },
  {
    category: "节日",
    tags: ["春节", "元宵节", "清明节", "端午节", "中秋节", "国庆节", "生日", "纪念日"]
  },
  {
    category: "天气",
    tags: ["晴天", "雨天", "雪天", "阴天", "多云", "大风", "雾霾", "彩虹"]
  },
  {
    category: "其他",
    tags: ["日常", "分享", "记录", "吐槽", "感悟", "推荐", "求助", "打卡"]
  }
];

export function MomentTags({ onTagSelect }: MomentTagsProps) {
  const [open, setOpen] = useState(false);

  const handleTagClick = (tag: string) => {
    onTagSelect(`#${tag}#`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          type="button"
        >
          <Hash className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <ScrollArea className="h-80">
          <div className="p-4 space-y-4">
            <h3 className="font-semibold text-sm">选择标签</h3>
            {tagCategories.map((category) => (
              <div key={category.category} className="space-y-2">
                <h4 className="text-xs text-muted-foreground font-medium">
                  {category.category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {category.tags.map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleTagClick(tag)}
                    >
                      #{tag}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
